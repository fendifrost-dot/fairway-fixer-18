import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildTradelineIdentityKey, type CreditBureau } from "../_shared/tradelineIdentity.ts";
import { diffCreditReport } from "../_shared/creditReportDiff.ts";
import {
  parseStructuredCreditReportText,
  type ParseStructuredTextResult,
} from "../_shared/parseStructuredText.ts";
import { parseCreditReportWithAI } from "../_shared/aiCreditParser.ts";

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
    const text = (body.text as string)?.trim();
    const scope = (body.scope as string) || "full_snapshot";
    const bureau = (body.bureau as string) || "transunion";
    const reportDate = (body.report_date as string) || new Date().toISOString().slice(0, 10);
    const furnisherFilter = body.furnisher_filter as string | undefined;
    const dryRun = body.dry_run === true;
    const sourceType = (body.source_type as string) || "paste";

    if (!clientId || !text) {
      return new Response(
        JSON.stringify({ error: "client_id and text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Primary path: LLM parser (handles PrivacyGuard tri-merge + layout variants
    // the regex parser chokes on). Falls back to the regex parser for tiny manual
    // pastes or if the AI call fails, so ingest never hard-depends on the gateway.
    const runRegex = () =>
      parseStructuredCreditReportText(text, { default_bureau: bureau as CreditBureau });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let parsed: ParseStructuredTextResult;
    let parseMode: "ai" | "regex_fallback" | "regex" = "regex";
    if (LOVABLE_API_KEY) {
      try {
        parsed = await parseCreditReportWithAI(text, {
          bureau,
          reportDate,
          apiKey: LOVABLE_API_KEY,
        });
        parseMode = "ai";
        if (parsed.rows.length === 0) {
          const regex = runRegex();
          if (regex.rows.length > 0) {
            parsed = regex;
            parseMode = "regex_fallback";
          }
        }
      } catch (e) {
        console.warn("AI parse failed; falling back to regex:", e instanceof Error ? e.message : e);
        parsed = runRegex();
        parseMode = "regex_fallback";
      }
    } else {
      parsed = runRegex();
    }

    const { data: existingTradelines } = await supabase
      .from("tradelines")
      .select(`
        id, identity_key, furnisher_raw, furnisher_normalized, account_mask, date_opened, loan_type,
        tradeline_bureau_states (
          bureau, balance, high_balance, past_due, monthly_payment, pay_status, account_status,
          remarks, two_year_payment_grid, dispute_flags, parse_confidence, date_reported, present, absent_in_latest
        )
      `)
      .eq("client_id", clientId);

    const existingRows = (existingTradelines ?? []).flatMap((tl) => {
      const states = (tl.tradeline_bureau_states as Record<string, unknown>[]) ?? [];
      return states.map((s) => ({
        id: tl.id as string,
        furnisher_raw: tl.furnisher_raw as string,
        furnisher_normalized: tl.furnisher_normalized as string,
        bureau: s.bureau as "equifax" | "experian" | "transunion",
        account_mask: (tl.account_mask as string) ?? "",
        date_opened: (tl.date_opened as string) ?? "",
        loan_type: tl.loan_type as string | undefined,
        balance: s.balance as number | null,
        high_balance: s.high_balance as number | null,
        past_due: s.past_due as number | null,
        monthly_payment: s.monthly_payment as number | null,
        pay_status: s.pay_status as string | undefined,
        account_status: s.account_status as string | undefined,
        remarks: (s.remarks as string[]) ?? [],
        two_year_payment_grid: (s.two_year_payment_grid as { month: string; status: string }[]) ?? [],
        dispute_flags: (s.dispute_flags as string[]) ?? [],
        parse_confidence: s.parse_confidence as number | undefined,
        date_reported: s.date_reported as string | undefined,
      }));
    });

    const diff = diffCreditReport(existingRows, parsed.rows, {
      scope: scope as "full_snapshot" | "partial_update" | "furnisher_update",
      bureau: bureau as "equifax" | "experian" | "transunion",
      report_date: reportDate,
      furnisher_filter: furnisherFilter,
    });

    if (dryRun) {
      return new Response(JSON.stringify({ diff, parsed, parse_mode: parseMode, warnings: parsed.warnings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creditReport, error: crErr } = await supabase
      .from("credit_reports")
      .insert({
        client_id: clientId,
        bureau,
        report_date: reportDate,
        import_scope: scope,
        source_type: sourceType,
        raw_text: text,
        parse_summary: diff.summary,
      })
      .select()
      .single();

    if (crErr) throw crErr;

    const upsertTradeline = async (row: typeof parsed.rows[0], existingId?: string) => {
      const identity_key = buildTradelineIdentityKey(row);
      const display_name = `${row.furnisher_raw} ${row.account_mask ?? ""}`.trim();

      let tradelineId = existingId;
      if (!tradelineId) {
        const { data: inserted, error } = await supabase
          .from("tradelines")
          .upsert({
            client_id: clientId,
            identity_key,
            furnisher_raw: row.furnisher_raw,
            furnisher_normalized: row.furnisher_normalized,
            account_mask: row.account_mask,
            date_opened: row.date_opened || null,
            loan_type: row.loan_type,
            display_name,
          }, { onConflict: "client_id,identity_key" })
          .select("id")
          .single();
        if (error) throw error;
        tradelineId = inserted.id;
      }

      await supabase.from("tradeline_bureau_states").upsert({
        tradeline_id: tradelineId,
        credit_report_id: creditReport.id,
        bureau: row.bureau,
        present: true,
        absent_in_latest: false,
        balance: row.balance,
        high_balance: row.high_balance,
        past_due: row.past_due,
        monthly_payment: row.monthly_payment,
        pay_status: row.pay_status,
        account_status: row.account_status,
        remarks: row.remarks ?? [],
        two_year_payment_grid: row.two_year_payment_grid ?? [],
        dispute_flags: row.dispute_flags ?? [],
        parse_confidence: row.parse_confidence,
        date_reported: row.date_reported,
        last_seen_date: reportDate,
      }, { onConflict: "tradeline_id,bureau" });

      return tradelineId;
    };

    for (const row of [...diff.added, ...diff.updated.map((u) => u.after), ...diff.unchanged]) {
      const key = buildTradelineIdentityKey(row);
      const existing = diff.updated.find((u) => u.identity_key === key);
      await upsertTradeline(row, existing?.before.id);
    }

    for (const absent of diff.absent_in_latest) {
      if (!absent.existing.id) continue;
      await supabase
        .from("tradeline_bureau_states")
        .update({ absent_in_latest: true, present: false, last_seen_date: reportDate })
        .eq("tradeline_id", absent.existing.id)
        .eq("bureau", bureau);
    }

    return new Response(
      JSON.stringify({
        credit_report_id: creditReport.id,
        diff: diff.summary,
        parse_mode: parseMode,
        warnings: parsed.warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    // Thrown Supabase PostgrestErrors are plain objects, not Error instances —
    // `String(err)` would yield "[object Object]" and hide the real cause.
    const obj = (err && typeof err === "object" ? err : null) as
      | { message?: unknown; error_description?: unknown; code?: unknown; details?: unknown; hint?: unknown }
      | null;
    const msg = err instanceof Error
      ? err.message
      : obj?.message != null || obj?.error_description != null
        ? String(obj.message ?? obj.error_description)
        : typeof err === "string"
          ? err
          : JSON.stringify(obj ?? null);
    console.error("ingest-credit-report error:", err);
    return new Response(
      JSON.stringify({
        error: msg,
        code: obj?.code ?? null,
        details: obj?.details ?? null,
        hint: obj?.hint ?? null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
