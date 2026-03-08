import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Server-side PII masking (defense-in-depth).
 * Client should mask before sending, but we mask again just in case.
 */
function maskPII(text: string): string {
  let masked = text;
  // SSN with dashes
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "XXX-XX-XXXX");
  // SSN without dashes (9 consecutive digits)
  masked = masked.replace(/(?<!\d)\d{9}(?!\d)/g, "XXXXXXXXX");
  // Account numbers: 10+ digits → ****last4
  masked = masked.replace(/(?<!\*)\b(\d{10,})\b/g, (m) => "****" + m.slice(-4));
  return masked;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lines } = await req.json();

    if (!Array.isArray(lines) || lines.length === 0) {
      return new Response(
        JSON.stringify({ error: "No lines provided", events: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cap at 50 lines to prevent abuse
    const cappedLines = (lines as string[]).slice(0, 50);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Server-side PII masking (defense-in-depth)
    const maskedLines = cappedLines.map(maskPII);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a credit report event parser. Extract structured timeline events from messy text lines about credit disputes, bureau responses, and outcomes.

Valid sources: Experian, TransUnion, Equifax, Innovis, LexisNexis, Sagestream, CoreLogic, ChexSystems, EWS, NCTUE, CFPB, FTC, BBB, AG, Other.
Valid event_kinds: action, response, outcome.
Valid categories: Action, Response, Outcome.

Rules:
- Extract dates in YYYY-MM-DD format when clearly present. Set event_date to null if ambiguous or missing.
- Set confidence to "high" if source AND date are clearly identifiable.
- Set confidence to "medium" if one of source/date is inferred.
- Set confidence to "low" if guessing on both.
- If a line is garbage, noise, or not a credit event, skip it entirely.
- Keep summaries factual and under 200 characters.
- Never invent information not present in the text.`,
            },
            {
              role: "user",
              content: `Parse these lines into structured credit timeline events. Skip lines that aren't actual credit events:\n\n${maskedLines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_events",
                description:
                  "Classify text lines into structured credit timeline events",
                parameters: {
                  type: "object",
                  properties: {
                    events: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          line_index: {
                            type: "number",
                            description: "1-based index of the source line",
                          },
                          event_kind: {
                            type: "string",
                            enum: ["action", "response", "outcome"],
                          },
                          category: {
                            type: "string",
                            enum: ["Action", "Response", "Outcome"],
                          },
                          source: {
                            type: "string",
                            description: "Bureau/agency name or Other",
                          },
                          event_date: {
                            type: "string",
                            description: "YYYY-MM-DD format or null if unknown",
                            nullable: true,
                          },
                          summary: {
                            type: "string",
                            description: "Brief factual summary under 200 chars",
                          },
                          confidence: {
                            type: "string",
                            enum: ["high", "medium", "low"],
                          },
                        },
                        required: [
                          "line_index",
                          "event_kind",
                          "category",
                          "source",
                          "summary",
                          "confidence",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["events"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "classify_events" },
          },
        }),
      }
    );

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
        JSON.stringify({ error: "AI parsing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({
          error: "No structured output from AI",
          events: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI output", events: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        events: parsed.events || [],
        line_count: cappedLines.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-with-ai error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
