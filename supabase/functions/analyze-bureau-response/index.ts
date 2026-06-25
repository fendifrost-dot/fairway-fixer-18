/**
 * Response Analyzer backend — bureau/furnisher reply + timeline evidence → draft letter JSON.
 * AI via Lovable gateway (LOVABLE_API_KEY injected by platform). Operator reviews before sending.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildSystemPrompt,
  mergeFlaggedInquiries,
  parseInquiriesFromReportText,
} from "../_shared/inquiryParse.ts";
import { loadAnalyzerContext, resolveEffectiveLetterMode } from "../_shared/analyzerContext.ts";
import { STATUTES_ALL, buildAnalyzerStrengthFloor } from "../_shared/disputeLetterGenerator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function maskPII(text: string): string {
  let masked = text;
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "XXX-XX-XXXX");
  masked = masked.replace(/(?<!\d)\d{9}(?!\d)/g, "XXXXXXXXX");
  masked = masked.replace(/(?<!\*)\b(\d{10,})\b/g, (m) => "****" + m.slice(-4));
  return masked;
}

const MAX_RESPONSE_CHARS = 10_000;
const MAX_EVENTS = 400;
const MAX_EVENTS_FOR_MODEL = 60;
const MAX_FIELD_CHARS = 500;
const AI_TIMEOUT_MS = 50_000;

function trimForModel(text: string, max = MAX_FIELD_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…[truncated]`;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — missing token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: {
      client_id?: string;
      bureau_source?: string;
      response_document_text?: string;
      letter_mode?: "initial" | "follow_up";
      dispute_focus?: "auto" | "tradeline" | "inquiry";
      flagged_inquiries?: {
        creditor: string;
        inquiry_date?: string | null;
        dispute_as_unauthorized?: boolean;
      }[];
    };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = body.client_id?.trim();
    const bureauSource = body.bureau_source?.trim();
    let responseText = (body.response_document_text || "").trim();

    if (!clientId || !bureauSource || !responseText) {
      return new Response(
        JSON.stringify({
          error: "client_id, bureau_source, and response_document_text are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestedLetterMode = body.letter_mode === "follow_up" ? "follow_up" : "initial";
    const disputeFocus = ["auto", "tradeline", "inquiry"].includes(body.dispute_focus ?? "")
      ? (body.dispute_focus as "auto" | "tradeline" | "inquiry")
      : "auto";

    let analyzerCtx;
    try {
      analyzerCtx = await loadAnalyzerContext(supabase, clientId, bureauSource);
    } catch (e) {
      if (e instanceof Error && e.message === "CLIENT_NOT_FOUND") {
        return new Response(
          JSON.stringify({ error: "Client not found or not accessible" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw e;
    }
    const { clientLabel, history, profile } = analyzerCtx;
    const effectiveLetterMode = resolveEffectiveLetterMode(requestedLetterMode, history);

    const { data: sourceEventRows, error: eventsError } = await supabase
      .from("timeline_events")
      .select(
        "event_kind, category, event_date, date_is_unknown, summary, title, raw_line, source, created_at"
      )
      .eq("client_id", clientId)
      .eq("source", bureauSource)
      .eq("is_draft", false)
      .in("event_kind", ["action", "response", "outcome", "note"])
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(MAX_EVENTS);

    if (eventsError) {
      return new Response(
        JSON.stringify({ error: "Failed to load timeline evidence", details: eventsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let evidenceScope: "same_source" | "all_sources_fallback" = "same_source";
    let events = sourceEventRows || [];
    const sameSourceCount = events.length;

    if (events.length === 0) {
      const { data: allEventRows, error: allErr } = await supabase
        .from("timeline_events")
        .select(
          "event_kind, category, event_date, date_is_unknown, summary, title, raw_line, source, created_at"
        )
        .eq("client_id", clientId)
        .eq("is_draft", false)
        .in("event_kind", ["action", "response", "outcome", "note"])
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(MAX_EVENTS);

      if (allErr) {
        return new Response(
          JSON.stringify({ error: "Failed to load timeline evidence", details: allErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      events = allEventRows || [];
      if (events.length > 0) evidenceScope = "all_sources_fallback";
    }

    const { data: taskRows } = await supabase
      .from("operator_tasks")
      .select("title, notes, due_date, status, priority")
      .eq("client_id", clientId)
      .in("status", ["Open", "Done"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(25);

    const scheduledTasks = (taskRows ?? []).map((t) => ({
      title: trimForModel(String(t.title || "")),
      notes: trimForModel(maskPII(String(t.notes || ""))),
      due_date: t.due_date,
      status: t.status,
      priority: t.priority,
    }));
    responseText = maskPII(responseText.slice(0, MAX_RESPONSE_CHARS));

    const eventsForModel = events.length > MAX_EVENTS_FOR_MODEL
      ? events.slice(-MAX_EVENTS_FOR_MODEL)
      : events;

    const evidenceForModel = eventsForModel.map((e) => ({
      event_kind: e.event_kind,
      category: e.category,
      event_date: e.event_date,
      date_is_unknown: e.date_is_unknown,
      source: e.source,
      title: trimForModel(maskPII(String(e.title || ""))),
      summary: trimForModel(maskPII(String(e.summary || ""))),
      raw_line: trimForModel(maskPII(String(e.raw_line || ""))),
    }));

    const parsedInquiries = mergeFlaggedInquiries(
      parseInquiriesFromReportText(responseText),
      body.flagged_inquiries ?? [],
    );
    const unauthorizedInquiries = parsedInquiries.filter((i) => i.dispute_as_unauthorized);
    const effectiveFocus =
      disputeFocus === "auto" && unauthorizedInquiries.length > 0 ? "inquiry" : disputeFocus;

    const accountIdentifiers = profile.tradelines.map((t) => {
      const mask = t.account_mask ? `acct ending ${t.account_mask}` : "acct # unknown";
      return `${t.furnisher_raw} (${mask})`;
    });

    const strength_floor = buildAnalyzerStrengthFloor({
      violations: [...profile.tradeline_violations, ...profile.credit_report_violations],
      priorRoundExists:
        history.prior_round_exists ||
        history.prior_letters.length > 0 ||
        history.bureau_responses.length > 0,
      hasReinsertionSignal: history.has_reinsertion_signal,
      hasFtcReport: Boolean(history.ftc_identity_theft_report_number),
      hasVerifiedWithoutDocs: history.has_verified_without_docs,
      isTradelineDispute: effectiveFocus !== "inquiry",
      evidenceTitles: history.prior_letters.map((l) => l.letter_type),
      accountIdentifiers,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonError(
        "LOVABLE_API_KEY is not configured — AI parsing works on this project but this function may need a Lovable redeploy/sync.",
        500,
      );
    }

    const userPrompt = `Target bureau/source (enum): ${bureauSource}
Letter mode (effective): ${effectiveLetterMode}${requestedLetterMode !== effectiveLetterMode ? ` (operator requested ${requestedLetterMode})` : ""}
Dispute focus: ${effectiveFocus}
Consumer reference name(s) (may be partial / masked): ${clientLabel}

--- Document text (credit report excerpt, bureau response, or operator paste; PII may be masked) ---
${responseText}

--- Hard inquiries parsed from document (${parsedInquiries.length} total; ${unauthorizedInquiries.length} flagged unauthorized) ---
${JSON.stringify(parsedInquiries)}

--- HISTORY DIGEST (dispute_rounds, prior letters, bureau_responses, FTC report, CFPB/AG tasks) ---
${JSON.stringify(history)}

--- PROFILE DIGEST (tradelines, violations, reinsertion signals) ---
${JSON.stringify(profile)}

--- Evidence timeline (${eventsForModel.length} of ${events.length} rows; scope: ${evidenceScope}; same-source count: ${sameSourceCount}) ---
${JSON.stringify(evidenceForModel)}

--- Scheduled operator tasks (planning context — not sworn evidence; ${scheduledTasks.length} rows) ---
${JSON.stringify(scheduledTasks)}

--- REQUIRED STATUTORY SCAFFOLD (incorporate applicable items) ---
${JSON.stringify(STATUTES_ALL)}

--- DETERMINISTIC VIOLATIONS + STRENGTH FLOOR ---
${JSON.stringify({ violations: [...profile.tradeline_violations, ...profile.credit_report_violations], strength_floor })}`;

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), AI_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: aiController.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(effectiveLetterMode, effectiveFocus, {
              prior_round_count: history.prior_round_count,
              prior_round_exists: history.prior_round_exists,
              has_verified_without_docs: history.has_verified_without_docs,
              has_reinsertion_signal: history.has_reinsertion_signal,
              ftc_identity_theft_report_number: history.ftc_identity_theft_report_number,
              has_ftc_report: Boolean(history.ftc_identity_theft_report_number),
              cfpb_or_ag_task_count: history.cfpb_or_ag_tasks.length,
              statutes_scaffold: strength_floor.statutes_invoked,
              account_identifiers: accountIdentifiers,
              required_strength_elements: strength_floor.required_strength_elements,
            }),
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "dispute_letter_draft",
              description: "Structured follow-up letter draft and operator checklist",
              parameters: {
                type: "object",
                properties: {
                  draft_letter: {
                    type: "string",
                    description:
                      "Full letter body — no bracket placeholders. Must include all applicable MAXIMUM-STRENGTH elements (§605B block when FTC on file, not-my-account statement, MOV demand, dual deadlines, account identifiers, §1681n willful notice when facts support). No separate Enclosures section; at most one inline Enclosed sentence.",
                  },
                  opening_summary: {
                    type: "string",
                    description: "One short paragraph summarizing the bureau position vs consumer position from inputs only",
                  },
                  supporting_bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "Factual bullets tied to evidence/response (no legal claims beyond facts)",
                  },
                  operator_checklist: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "Items the operator must confirm before mailing: enclosures (FTC report copy, photo ID, proof of address), one confirmation line per disputed tradeline/account when multiple items appear in profile digest, account numbers, mailing gates, facts to verify.",
                  },
                },
                required: ["draft_letter", "supporting_bullets", "operator_checklist"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "dispute_letter_draft" },
        },
      }),
      });
    } catch (fetchErr) {
      clearTimeout(aiTimeout);
      const aborted = fetchErr instanceof Error && fetchErr.name === "AbortError";
      console.error("AI gateway fetch error:", fetchErr);
      return jsonError(
        aborted
          ? "Letter draft timed out — try a shorter bureau response paste or fewer timeline rows."
          : "Letter draft request failed to reach AI gateway",
        aborted ? 504 : 502,
      );
    } finally {
      clearTimeout(aiTimeout);
    }

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted — please add funds" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(
        JSON.stringify({ error: "Letter draft request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "No structured output from AI", result: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: {
      draft_letter?: string;
      opening_summary?: string;
      supporting_bullets?: string[];
      operator_checklist?: string[];
    };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI output", result: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        result: {
          draft_letter: parsed.draft_letter || "",
          opening_summary: parsed.opening_summary || "",
          supporting_bullets: parsed.supporting_bullets || [],
          operator_checklist: parsed.operator_checklist || [],
          strength_checklist: strength_floor,
        },
        meta: {
          evidence_event_count: events.length,
          evidence_same_source_count: sameSourceCount,
          evidence_scope: evidenceScope,
          scheduled_task_count: scheduledTasks.length,
          inquiries_parsed: parsedInquiries.length,
          inquiries_flagged_unauthorized: unauthorizedInquiries.length,
          letter_mode: effectiveLetterMode,
          letter_mode_requested: requestedLetterMode,
          letter_mode_overridden: requestedLetterMode !== effectiveLetterMode,
          prior_round_exists: history.prior_round_exists,
          prior_round_count: history.prior_round_count,
          prior_letters_count: history.prior_letters.length,
          bureau_responses_count: history.bureau_responses.length,
          has_reinsertion_signal: history.has_reinsertion_signal,
          has_verified_without_docs: history.has_verified_without_docs,
          ftc_report_on_file: Boolean(history.ftc_identity_theft_report_number),
          tradeline_count: profile.tradelines.length,
          violation_count: profile.tradeline_violations.length + profile.credit_report_violations.length,
          dispute_focus: effectiveFocus,
          evidence_events_sent_to_model: eventsForModel.length,
          evidence_truncated: events.length > eventsForModel.length,
          bureau_source: bureauSource,
          response_chars_used: responseText.length,
          history_digest_loaded: true,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-bureau-response error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
