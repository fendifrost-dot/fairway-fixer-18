import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  analyzeTradelineViolations,
  type TradelineForLetter,
} from "../_shared/disputeLetterGenerator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function detectDataQualityAnomaly(tl: TradelineForLetter & {
  pay_status?: string;
  account_status?: string;
}): string | null {
  const statusText = `${tl.account_status ?? ""} ${tl.pay_status ?? ""}`.toLowerCase();
  const balance = tl.balance ?? 0;
  const grid = tl.two_year_payment_grid ?? [];
  const hasGrid = grid.length > 0;
  const neverLate =
    hasGrid &&
    grid.every((g) => {
      const s = g.status.toUpperCase();
      return s === "OK" || s === "CURRENT" || s === "—" || s === "-" || s === "C";
    });

  const derogatoryStatus =
    statusText.includes("unrated") ||
    statusText.includes("bankruptcy") ||
    statusText.includes("charge") ||
    statusText.includes("collection");

  if (derogatoryStatus && balance === 0 && (neverLate || !hasGrid)) {
    const label = tl.account_status || tl.pay_status || "derogatory status";
    return `Data-quality anomaly: "${label}" with $0 balance and no supporting late-payment history — inconsistent Metro 2 coding that may indicate wrongful derogatory reporting.`;
  }

  return null;
}

function analyzeWithDataQuality(tradelines: (TradelineForLetter & {
  id?: string;
  pay_status?: string;
  account_status?: string;
})[]) {
  const base = analyzeTradelineViolations(tradelines);
  for (const tl of tradelines) {
    const dq = detectDataQualityAnomaly(tl);
    if (dq) {
      base.push({
        type: "data_quality_anomaly",
        narrative: `${tl.furnisher_raw} (${tl.account_mask ?? "acct"}): ${dq}`,
        severity: "medium",
      });
    }
  }
  return base.map((v, i) => {
    const tl = tradelines.find((t) => v.narrative.startsWith(t.furnisher_raw));
    return { ...v, tradeline_id: tl?.id, key: `${v.type}-${i}` };
  });
}

function buildBaselineSummary(
  bureau: string,
  reportDate: string,
  tradelineCount: number,
  violations: { severity?: string }[],
): string {
  const high = violations.filter((v) => v.severity === "high").length;
  const medium = violations.filter((v) => v.severity === "medium").length;
  return [
    `**${bureau.charAt(0).toUpperCase()}${bureau.slice(1)} report — ${reportDate}**`,
    "",
    `- Tradelines analyzed: **${tradelineCount}**`,
    `- Violations flagged: **${violations.length}** (${high} high, ${medium} medium)`,
    violations.length > 0
      ? "- Review flagged items before drafting dispute letters."
      : "- No automatic violations detected; operator may still dispute on other grounds.",
  ].join("\n");
}

function buildLetterSuggestions(violations: { type: string }[]) {
  const suggestions: {
    label: string;
    letter_type: string;
    recipient_type: string;
    recipient_name: string;
    rationale: string;
  }[] = [];

  if (violations.some((v) => v.type === "impossible_payment_progression" || v.type === "mass_replication")) {
    suggestions.push({
      label: "MOV / verify or delete",
      letter_type: "Method-of-Verification Demand",
      recipient_type: "cra",
      recipient_name: "Credit Bureau",
      rationale: "Impossible payment grid or mass-replication patterns require bureau verification under §1681i.",
    });
  }

  if (violations.some((v) => v.type === "data_quality_anomaly")) {
    suggestions.push({
      label: "Furnisher §1681s-2 dispute",
      letter_type: "Furnisher Direct Dispute",
      recipient_type: "furnisher",
      recipient_name: "Furnisher",
      rationale: "Inconsistent account status vs. balance/payment history — furnisher accuracy duty under §1681s-2(a)(1)(A).",
    });
  }

  if (violations.length > 0 && suggestions.length === 0) {
    suggestions.push({
      label: "Bureau dispute",
      letter_type: "Bureau Dispute",
      recipient_type: "cra",
      recipient_name: "Credit Bureau",
      rationale: "Flagged violations warrant bureau reinvestigation under §1681i.",
    });
  }

  return suggestions;
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
    const creditReportId = body.credit_report_id as string;
    const clientId = body.client_id as string;

    if (!creditReportId || !clientId) {
      return new Response(
        JSON.stringify({ error: "credit_report_id and client_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: creditReport, error: crErr } = await supabase
      .from("credit_reports")
      .select("id, client_id, bureau, report_date")
      .eq("id", creditReportId)
      .eq("client_id", clientId)
      .single();

    if (crErr || !creditReport) {
      return new Response(JSON.stringify({ error: "Credit report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bureauStates, error: bureauStatesError } = await supabase
      .from("tradeline_bureau_states")
      .select(`
        balance, pay_status, account_status, two_year_payment_grid,
        tradelines!inner (
          id, furnisher_raw, account_mask, date_opened, client_id
        )
      `)
      .eq("credit_report_id", creditReportId);

    if (bureauStatesError) {
      return new Response(
        JSON.stringify({ error: `Failed to load tradelines: ${bureauStatesError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tradelines = (bureauStates ?? []).flatMap((row) => {
      const embedded = row.tradelines as
        | {
            id: string;
            furnisher_raw: string;
            account_mask: string | null;
            date_opened: string | null;
            client_id: string;
          }
        | {
            id: string;
            furnisher_raw: string;
            account_mask: string | null;
            date_opened: string | null;
            client_id: string;
          }[]
        | null;
      const tl = Array.isArray(embedded) ? embedded[0] : embedded;
      if (!tl || tl.client_id !== clientId) return [];
      return [{
        id: tl.id,
        furnisher_raw: tl.furnisher_raw,
        account_mask: tl.account_mask ?? undefined,
        date_opened: tl.date_opened ?? undefined,
        balance: row.balance as number | null,
        pay_status: row.pay_status as string | undefined,
        account_status: row.account_status as string | undefined,
        two_year_payment_grid: (row.two_year_payment_grid as { month: string; status: string }[]) ?? [],
      }];
    });

    const violations = analyzeWithDataQuality(tradelines);
    const baselineSummary = buildBaselineSummary(
      creditReport.bureau as string,
      creditReport.report_date as string,
      tradelines.length,
      violations,
    );
    const letterSuggestions = buildLetterSuggestions(violations);

    const payload = {
      credit_report_id: creditReportId,
      client_id: clientId,
      violations,
      baseline_summary: baselineSummary,
      letter_suggestions: letterSuggestions,
      analyzed_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("credit_report_analyses")
      .select("id")
      .eq("credit_report_id", creditReportId)
      .maybeSingle();

    let analysis;
    if (existing?.id) {
      const { data, error } = await supabase
        .from("credit_report_analyses")
        .update({
          violations,
          baseline_summary: baselineSummary,
          letter_suggestions: letterSuggestions,
          analyzed_at: payload.analyzed_at,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      analysis = data;
    } else {
      const { data, error } = await supabase
        .from("credit_report_analyses")
        .insert({
          credit_report_id: creditReportId,
          client_id: clientId,
          violations,
          baseline_summary: baselineSummary,
          letter_suggestions: letterSuggestions,
          analyzed_at: payload.analyzed_at,
        })
        .select()
        .single();
      if (error) throw error;
      analysis = data;
    }

    return new Response(
      JSON.stringify({ ...payload, analysis_id: analysis.id }),
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
