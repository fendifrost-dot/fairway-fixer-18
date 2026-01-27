// Lovable Cloud backend function: run the matters insert probe under the caller's JWT
// so we see the exact RLS/search_path behavior the user experiences.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const [probeRes, snapRes, variantsRes, claimsRes, diagnoseRes] = await Promise.all([
      supabase.rpc("probe_matters_insert", { p_client_id: clientId }),
      supabase.rpc("__snapshot_matters_rls"),
      supabase.rpc("probe_matters_ownerid_variants", { p_client_id: clientId }),
      supabase.rpc("prove_request_claims"),
      supabase.rpc("diagnose_matters_insert", { p_client_id: clientId }),
    ]);

    return new Response(
      JSON.stringify(
        {
          ok: true,
          probe: probeRes.data as Json,
          probe_error: probeRes.error,
          ownerid_variants: variantsRes.data as Json,
          ownerid_variants_error: variantsRes.error,
          request_claims: claimsRes.data as Json,
          request_claims_error: claimsRes.error,
          diagnose: diagnoseRes.data as Json,
          diagnose_error: diagnoseRes.error,
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
          ...corsHeaders,
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }, null, 2),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
