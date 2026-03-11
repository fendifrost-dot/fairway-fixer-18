import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Authenticate via shared secret
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("CREDIT_GUARDIAN_KEY");

  if (!expectedKey || apiKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Service-role client bypasses RLS for cross-project access
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  let body: { action?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action, params } = body;

  // ── 1. get_clients ────────────────────────────────────────────────
  if (action === "get_clients") {
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, legal_name, preferred_name, email, phone, status, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    return json({ data, error });
  }

  // ── 2. get_client_detail ──────────────────────────────────────────
  if (action === "get_client_detail") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const [client, matters, events, tasks] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("matters").select("*").eq("client_id", clientId),
      supabase
        .from("timeline_events")
        .select("*")
        .eq("client_id", clientId)
        .order("event_date", { ascending: false })
        .limit(50),
      supabase.from("operator_tasks").select("*").eq("client_id", clientId),
    ]);

    return json({
      client: client.data,
      matters: matters.data,
      events: events.data,
      tasks: tasks.data,
      errors: {
        client: client.error,
        matters: matters.error,
        events: events.error,
        tasks: tasks.error,
      },
    });
  }

  // ── 3. update_client_record ───────────────────────────────────────
  if (action === "update_client_record") {
    const p = params as Record<string, unknown> | undefined;
    const clientId = p?.client_id as string;
    const fields = p?.fields as Record<string, unknown> | undefined;

    if (!clientId || !fields) {
      return json({ error: "client_id and fields required" }, 400);
    }

    const allowed = [
      "legal_name",
      "preferred_name",
      "email",
      "phone",
      "status",
      "notes",
    ];
    const safe: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) {
      if (allowed.includes(k)) safe[k] = fields[k];
    }

    if (Object.keys(safe).length === 0) {
      return json({ error: "No valid fields provided" }, 400);
    }

    const { data, error } = await supabase
      .from("clients")
      .update(safe)
      .eq("id", clientId)
      .select()
      .single();

    return json({ data, error });
  }

  // ── 4. get_documents ──────────────────────────────────────────────
  if (action === "get_documents") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const { data: matterRows } = await supabase
      .from("matters")
      .select("id")
      .eq("client_id", clientId);

    const ids = (matterRows ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) return json({ actions: [], responses: [] });

    const [actions, responses] = await Promise.all([
      supabase
        .from("actions")
        .select(
          "id, matter_id, action_type, summary, attachment_url, action_date"
        )
        .in("matter_id", ids)
        .not("attachment_url", "is", null),
      supabase
        .from("responses")
        .select(
          "id, matter_id, response_type, summary, attachment_url, received_date"
        )
        .in("matter_id", ids)
        .not("attachment_url", "is", null),
    ]);

    return json({ actions: actions.data, responses: responses.data });
  }

  // ── 5. get_recent_activity ────────────────────────────────────────
  if (action === "get_recent_activity") {
    const limit = ((params as Record<string, unknown>)?.limit as number) ?? 25;

    const { data, error } = await supabase
      .from("timeline_events")
      .select(
        "id, client_id, event_date, category, source, summary, title, event_kind, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));

    return json({ data, error });
  }

  return json({ error: "Unknown action" }, 400);
});
