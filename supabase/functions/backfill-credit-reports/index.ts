import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Bureau = "equifax" | "experian" | "transunion";

interface BureauStateRow {
  id: string;
  bureau: Bureau;
  credit_report_id: string | null;
  last_seen_date: string | null;
  balance: number | null;
  pay_status: string | null;
  account_status: string | null;
  two_year_payment_grid: { month: string; status: string }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const clientId = body.client_id as string;
    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tradelines } = await supabase
      .from("tradelines")
      .select(`
        id,
        tradeline_bureau_states (
          id, bureau, credit_report_id, last_seen_date
        )
      `)
      .eq("client_id", clientId);

    const groups = new Map<string, { bureau: Bureau; date: string; stateIds: string[] }>();

    for (const tl of tradelines ?? []) {
      const states = (tl.tradeline_bureau_states as BureauStateRow[]) ?? [];
      for (const s of states) {
        if (s.credit_report_id) continue;
        const date = s.last_seen_date ?? new Date().toISOString().slice(0, 10);
        const key = `${s.bureau}:${date}`;
        const existing = groups.get(key);
        if (existing) {
          existing.stateIds.push(s.id);
        } else {
          groups.set(key, { bureau: s.bureau, date, stateIds: [s.id] });
        }
      }
    }

    const created: { id: string; bureau: Bureau; report_date: string }[] = [];

    for (const group of groups.values()) {
      const { data: creditReport, error: crErr } = await supabase
        .from("credit_reports")
        .insert({
          client_id: clientId,
          bureau: group.bureau,
          report_date: group.date,
          import_scope: "full_snapshot",
          source_type: "paste",
          raw_text: "[Backfill] Reconstructed from existing tradeline bureau states",
          parse_summary: {
            backfill: true,
            tradeline_state_count: group.stateIds.length,
          },
        })
        .select("id, bureau, report_date")
        .single();

      if (crErr) throw crErr;

      const { error: linkErr } = await supabase
        .from("tradeline_bureau_states")
        .update({ credit_report_id: creditReport.id })
        .in("id", group.stateIds);

      if (linkErr) throw linkErr;
      created.push(creditReport);
    }

    return new Response(
      JSON.stringify({ created_count: created.length, credit_reports: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
