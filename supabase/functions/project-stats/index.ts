import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

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
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      counts[table] = error ? -1 : (count ?? 0);
    })
  );

  return new Response(
    JSON.stringify({ project_name: "Fairway Fixer", tables: counts }, null, 2),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
});
