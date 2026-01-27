// Lovable Cloud backend function: run the matters insert probe under the caller's JWT
// so we see the exact RLS/search_path behavior the user experiences.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    "";

  if (!supabaseUrl || !anonKey) {
    return new Response(
      JSON.stringify({
        error: "Missing backend env vars SUPABASE_URL / SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  // IMPORTANT: we forward the caller's Authorization header so the RPC executes
  // as the user (authenticated role) and matches UI behavior.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const body = (await req.json().catch(() => null)) as null | {
      client_id?: string;
    };

    const clientId = body?.client_id;
    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [probeRes, snapRes] = await Promise.all([
      supabase.rpc("probe_matters_insert", { p_client_id: clientId }),
      supabase.rpc("__snapshot_matters_rls"),
    ]);

    return new Response(
      JSON.stringify(
        {
          ok: true,
          probe: probeRes.data as Json,
          probe_error: probeRes.error,
          snapshot: snapRes.data as Json,
          snapshot_error: snapRes.error,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }, null, 2),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
