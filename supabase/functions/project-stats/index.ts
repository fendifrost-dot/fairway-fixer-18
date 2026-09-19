import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

/**
 * project-stats — row-count dashboard for staff/admin operators only.
 *
 * SECURITY (B2): this function reads under the service role (RLS bypass), so it
 * MUST authenticate the caller itself. It requires a valid Supabase JWT whose
 * user holds an `admin` or `staff` role. verify_jwt is also enabled in
 * config.toml as a first line of defense; the in-code role check is the second.
 */

const STAFF_ROLES = ["admin", "staff"];

/** Allow-listed browser origins (comma-separated env). No "*" for a service-role endpoint. */
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = (Deno.env.get("CREDIT_GUARDIAN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 2), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

  // --- AuthN: resolve the caller from the forwarded JWT ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Unauthorized: missing bearer token" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Unauthorized: invalid session" }, 401);
  }

  // --- AuthZ: caller must be admin or staff (checked with the service role) ---
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: roleRows, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (roleErr) {
    return json({ error: "Authorization check failed" }, 500);
  }

  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r) => STAFF_ROLES.includes(r))) {
    return json({ error: "Forbidden: staff or admin role required" }, 403);
  }

  // --- Authorized: return row counts ---
  const tableNames = [
    "clients",
    "matters",
    "entity_cases",
    "actions",
    "responses",
    "deadlines",
    "violations",
    "tasks",
    "overlays",
    "operator_tasks",
    "timeline_events",
    "baseline_analyses",
    "baseline_targets",
    "source_corrections",
    "saved_views",
    "case_actions",
    "profiles",
    "user_roles",
  ];

  const counts: Record<string, number> = {};

  await Promise.all(
    tableNames.map(async (table) => {
      const { count, error } = await admin
        .from(table)
        .select("*", { count: "exact", head: true });
      counts[table] = error ? -1 : (count ?? 0);
    })
  );

  return json({ project_name: "Fairway Fixer", tables: counts }, 200);
});
