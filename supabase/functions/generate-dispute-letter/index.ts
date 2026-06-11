import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildDisputeLetterBody } from "../_shared/disputeLetterGenerator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const roundId = body.round_id as string | undefined;
    const recipientType = body.recipient_type as "cra" | "furnisher" | "collector" | "regulator";
    const recipientName = body.recipient_name as string;
    const letterType = body.letter_type as string;
    const tradelineIds = (body.tradeline_ids as string[]) ?? [];

    if (!clientId || !recipientType || !recipientName || !letterType) {
      return new Response(
        JSON.stringify({ error: "client_id, recipient_type, recipient_name, letter_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: client } = await supabase
      .from("clients")
      .select("legal_name, legal_full_name, preferred_name, ftc_identity_theft_report_number")
      .eq("id", clientId)
      .single();

    let tradelinesQuery = supabase
      .from("tradelines")
      .select("id, furnisher_raw, account_mask, date_opened, balance, tradeline_bureau_states(two_year_payment_grid)")
      .eq("client_id", clientId);

    if (tradelineIds.length > 0) {
      tradelinesQuery = tradelinesQuery.in("id", tradelineIds);
    }

    const { data: tradelineRows } = await tradelinesQuery;

    const tradelines = (tradelineRows ?? []).map((tl) => {
      const states = (tl.tradeline_bureau_states as { two_year_payment_grid: unknown }[]) ?? [];
      const grid = states.flatMap((s) => (s.two_year_payment_grid as { month: string; status: string }[]) ?? []);
      return {
        id: tl.id as string,
        furnisher_raw: tl.furnisher_raw as string,
        account_mask: tl.account_mask as string | undefined,
        date_opened: tl.date_opened as string | undefined,
        balance: tl.balance as number | null,
        two_year_payment_grid: grid,
      };
    });

    const { data: evidenceEvents } = await supabase
      .from("timeline_events")
      .select("id, title, summary, details")
      .eq("client_id", clientId)
      .or("title.ilike.%admission%,title.ilike.%reversal%,title.ilike.%refund%")
      .limit(5);

    const evidence = (evidenceEvents ?? []).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      quote: (e.details ?? e.summary) as string | undefined,
    }));

    const { data: priorRounds } = await supabase
      .from("dispute_rounds")
      .select("id")
      .eq("client_id", clientId)
      .limit(1);

    let letterResult;
    try {
      letterResult = buildDisputeLetterBody({
        clientName: (client?.legal_full_name ?? client?.legal_name ?? "Client") as string,
        recipientType,
        recipientName,
        letterType,
        tradelines,
        violations: [],
        evidence,
        priorRoundExists: (priorRounds?.length ?? 0) > 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg, needs_report: msg.includes("NEEDS_REPORT") }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: letter, error: letterErr } = await supabase
      .from("dispute_letters")
      .insert({
        client_id: clientId,
        round_id: roundId ?? null,
        recipient_type: recipientType,
        recipient_name: recipientName,
        letter_type: letterType,
        body_md: letterResult.body_md,
        statutes: letterResult.statutes,
        tradeline_ids: tradelines.map((t) => t.id).filter(Boolean),
        evidence_ids: evidence.map((e) => e.id).filter(Boolean),
        strength_checklist: letterResult.strength_checklist,
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();

    if (letterErr) throw letterErr;

    const { data: timelineEvent, error: teErr } = await supabase
      .from("timeline_events")
      .insert({
        client_id: clientId,
        round_id: roundId ?? null,
        category: "Action",
        event_kind: "action",
        source: recipientType === "cra" ? recipientName.split(" ")[0] : "Other",
        title: letterType,
        summary: `${letterType} drafted for ${recipientName}`,
        details: letterResult.body_md,
        raw_line: `[Auto-generated dispute letter] ${letterType}`,
        event_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (teErr) throw teErr;

    await supabase
      .from("dispute_letters")
      .update({ timeline_event_id: timelineEvent.id })
      .eq("id", letter.id);

    return new Response(
      JSON.stringify({
        letter_id: letter.id,
        timeline_event_id: timelineEvent.id,
        body_md: letterResult.body_md,
        strength_checklist: letterResult.strength_checklist,
      }),
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
