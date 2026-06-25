/**
 * Response Analyzer backend — bureau/furnisher reply + timeline evidence → draft letter JSON.
 * AI via Lovable gateway (LOVABLE_API_KEY injected by platform). Operator reviews before sending.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id, legal_name, preferred_name")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr || !clientRow) {
      return new Response(
        JSON.stringify({ error: "Client not found or not accessible" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: eventRows, error: eventsError } = await supabase
      .from("timeline_events")
      .select(
        "event_kind, category, event_date, date_is_unknown, summary, title, raw_line, created_at"
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

    const events = eventRows || [];
    responseText = maskPII(responseText.slice(0, MAX_RESPONSE_CHARS));

    const eventsForModel = events.length > MAX_EVENTS_FOR_MODEL
      ? events.slice(-MAX_EVENTS_FOR_MODEL)
      : events;

    const evidenceForModel = eventsForModel.map((e) => ({
      event_kind: e.event_kind,
      category: e.category,
      event_date: e.event_date,
      date_is_unknown: e.date_is_unknown,
      title: trimForModel(maskPII(String(e.title || ""))),
      summary: trimForModel(maskPII(String(e.summary || ""))),
      raw_line: trimForModel(maskPII(String(e.raw_line || ""))),
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonError(
        "LOVABLE_API_KEY is not configured — AI parsing works on this project but this function may need a Lovable redeploy/sync.",
        500,
      );
    }

    const clientLabel = [clientRow.preferred_name, clientRow.legal_name].filter(Boolean).join(" / ");

    const userPrompt = `Target bureau/source (enum): ${bureauSource}
Consumer reference name(s) (may be partial / masked): ${clientLabel || "Not provided"}

--- Bureau / furnisher RESPONSE document (PII may be masked) ---
${responseText}

--- Prior evidence timeline rows for the SAME source (${bureauSource}) on this file (${eventsForModel.length} of ${events.length} events shown, non-draft) ---
${JSON.stringify(evidenceForModel)}`;

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
            content: `You assist a credit-file dispute professional drafting a follow-up letter. You are NOT a lawyer and do not give legal advice.

Rules:
- Use ONLY facts present in the bureau response text and the evidence timeline JSON. Never invent dates, account numbers, investigation outcomes, or communications.
- If something important is missing from the inputs, add it to operator_checklist (things the operator must verify or fill in before sending).
- The letter must be professional, factual, and ready for the operator to edit. Do not assert legal conclusions; describe what was sent, what was received, and what the consumer disputes or requests based on the supplied facts.
- Reference the volume and nature of prior correspondence only as summarized from the evidence rows (counts, dates, kinds of events).
- Valid event_kind values in evidence: action, response, outcome, note.`,
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
                    description: "Full letter body the operator can edit (salutation may be generic)",
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
                    description: "Items the operator must confirm, add, or correct before mailing",
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
        },
        meta: {
          evidence_event_count: events.length,
          evidence_events_sent_to_model: eventsForModel.length,
          evidence_truncated: events.length > eventsForModel.length,
          bureau_source: bureauSource,
          response_chars_used: responseText.length,
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
