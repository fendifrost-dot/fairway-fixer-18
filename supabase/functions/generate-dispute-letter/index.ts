import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildDisputeLetterBody,
  type LetterDisputeHistory,
} from "../_shared/disputeLetterGenerator.ts";
import { loadAnalyzerContext } from "../_shared/analyzerContext.ts";
import { isScenarioType } from "../_shared/letterStrengthBlocks.ts";

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
    const scenarioType = isScenarioType(body.scenario_type) ? body.scenario_type : undefined;

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
      .select("id, furnisher_raw, account_mask, date_opened, tradeline_bureau_states(balance, pay_status, account_status, two_year_payment_grid)")
      .eq("client_id", clientId);

    if (tradelineIds.length > 0) {
      tradelinesQuery = tradelinesQuery.in("id", tradelineIds);
    }

    const { data: tradelineRows } = await tradelinesQuery;

    const tradelines = (tradelineRows ?? []).map((tl) => {
      const states = (tl.tradeline_bureau_states as {
        balance: number | null;
        pay_status: string | null;
        account_status: string | null;
        two_year_payment_grid: unknown;
      }[]) ?? [];
      const primary = states[0];
      const grid = states.flatMap((s) => (s.two_year_payment_grid as { month: string; status: string }[]) ?? []);
      return {
        id: tl.id as string,
        furnisher_raw: tl.furnisher_raw as string,
        account_mask: tl.account_mask as string | undefined,
        date_opened: tl.date_opened as string | undefined,
        balance: primary?.balance ?? null,
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

    // Load the recipient-scoped dispute history (rounds, prior letters, bureau
    // responses, reinsertion/verified-without-docs signals, FTC report, filed
    // complaints) so the draft is a documented follow-up rather than a
    // standalone "initial" letter. Reuses the same digest the Response Analyzer
    // builds. Degrade gracefully — a history-load failure must not block the
    // letter, it just produces the older history-blind draft.
    let history: LetterDisputeHistory | undefined;
    try {
      const ctx = await loadAnalyzerContext(supabase, clientId, recipientName);
      const h = ctx.history;
      history = {
        prior_round_count: h.prior_round_count,
        dispute_rounds: h.dispute_rounds,
        prior_letters: h.prior_letters.map((l) => ({
          letter_type: l.letter_type,
          recipient_name: l.recipient_name,
          status: l.status,
          created_at: l.created_at,
        })),
        bureau_responses: h.bureau_responses,
        ftc_report_number: h.ftc_identity_theft_report_number,
        cfpb_or_ag_tasks: h.cfpb_or_ag_tasks.map((t) => ({ title: t.title, status: t.status })),
        has_verified_without_docs: h.has_verified_without_docs,
        has_reinsertion_signal: h.has_reinsertion_signal,
      };
    } catch (histErr) {
      console.error("generate-dispute-letter: history load failed, proceeding without it:", histErr);
      history = undefined;
    }

    const priorRoundExists =
      (priorRounds?.length ?? 0) > 0 ||
      (history
        ? history.prior_round_count > 0 ||
          history.prior_letters.length > 0 ||
          history.bureau_responses.length > 0
        : false);

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
        priorRoundExists,
        scenarioType,
        ftcReportNumber: client?.ftc_identity_theft_report_number ?? null,
        history,
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
