import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Server-side PII masking (defense-in-depth).
 * NOTE: We deliberately do NOT mask SSN/account numbers in the narrative we
 * send to the model, because the operator may want the model to extract
 * ssn_last4 and account references. The narrative is only ever sent through
 * Lovable AI Gateway (LOVABLE_API_KEY) and never persisted by the model.
 * However, we DO require an authenticated caller.
 */

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

    const { narrative } = await req.json();
    if (typeof narrative !== "string" || !narrative.trim()) {
      return new Response(
        JSON.stringify({ error: "narrative required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = narrative.slice(0, 30000); // hard cap

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You extract structured data from a credit-repair operator's intake narrative.

Return TWO things via the extract_intake tool:

1) identity: structured PII fields. ONLY fill a field when the narrative clearly and unambiguously states it. Leave null / empty otherwise. Never fabricate.
   - dob: YYYY-MM-DD or null
   - current_address: full single-line address string or null
   - ssn_last4: last 4 digits of SSN as a 4-character string or null
   - phone: digits only or null
   - email: lowercase or null
   - alternate_addresses: array of address strings (may be empty)

2) structured_blob: a single text block formatted EXACTLY in the project's pipe-delimited section format the in-app deterministic parser expects. Use these section headers verbatim:

   COMPLETED ACTIONS:
   RESPONSES RECEIVED:
   OUTCOMES OBSERVED:
   OPEN / UNRESOLVED ITEMS:
   SUGGESTED NEXT ACTIONS:

   Each row must be pipe-delimited. Examples:

   COMPLETED ACTIONS:
   2025-01-15 | Experian | Dispute Letter | Account ABC | Certified mail

   RESPONSES RECEIVED:
   2025-02-10 | Experian | Verified | No docs provided | Account (****1234)

   OUTCOMES OBSERVED:
   2025-02-15 | Equifax | Account Deleted | Removed from report | -

   OPEN / UNRESOLVED ITEMS:
   Experian | Collection account | Disputed | ABC Collections | 2025-01-20

   SUGGESTED NEXT ACTIONS:
   2025-02-25 | File CFPB Complaint | CFPB | High | Re: violation

   Round tagging: when the narrative associates events with a specific dispute round (e.g. "Round 1 mailed Dec 2", "Round 2 letters drafted today"), insert a line "[Round N]" on its own line BEFORE the affected rows within that section. The tag applies to subsequent rows until the next section header or next [Round N] tag. Do NOT invent rounds; only tag when explicit.

   Valid sources (case-sensitive): Experian, TransUnion, Equifax, Innovis, LexisNexis, Sagestream, CoreLogic, FTC, CFPB, BBB, AG, Other. If a row applies to all credit bureaus, use "All CRAs" as the source.

   Furnishers (B4): If a row's correspondence is from a creditor / collection agency / lender / servicer (e.g. "OneMain Financial", "Discover Bank", "LVNV Funding", "Capital One"), put the furnisher's name verbatim in the source column with a "(furnisher)" tag, e.g. "OneMain Financial (furnisher)". The in-app pipeline will resolve it. Use the furnisher form ONLY when the source is clearly a non-bureau entity.

   Date format: YYYY-MM-DD. Use YYYY-MM-XX if only month/year known. Omit the date column entirely (start the row with the source) if the date is fully unknown.

3) credit_scores: structured snapshot of the most recently mentioned score per credit bureau. ONLY fill a bureau when the narrative explicitly states a numeric score for that bureau. Each entry is { score, as_of }. as_of is YYYY-MM-DD when an exact date is given; otherwise null. Omit bureaus that are not mentioned. Score range 300-900.

Rules:
- Only emit sections that have content. If no actions/responses/outcomes were performed, omit those sections.
- Do NOT fabricate dates, sources, account numbers, or events. When ambiguous, omit the row entirely rather than guessing.
- Keep summaries factual and short.
- Output ONLY the structured_blob text — no commentary, no markdown fences.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Intake narrative:\n\n${text}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_intake",
                description: "Extract identity fields and a structured timeline blob from the intake narrative.",
                parameters: {
                  type: "object",
                  properties: {
                    identity: {
                      type: "object",
                      properties: {
                        dob: { type: "string", nullable: true, description: "YYYY-MM-DD or null" },
                        current_address: { type: "string", nullable: true },
                        ssn_last4: { type: "string", nullable: true, description: "Exactly 4 digits or null" },
                        phone: { type: "string", nullable: true, description: "Digits only" },
                        email: { type: "string", nullable: true },
                        alternate_addresses: { type: "array", items: { type: "string" } },
                      },
                      required: ["dob", "current_address", "ssn_last4", "phone", "email", "alternate_addresses"],
                      additionalProperties: false,
                    },
                    structured_blob: {
                      type: "string",
                      description: "Pipe-delimited sectioned text in the parser's expected format. Empty string if nothing extractable.",
                    },
                    credit_scores: {
                      type: "object",
                      description: "Most-recent credit score per bureau. Omit bureaus that aren't explicitly stated.",
                      properties: {
                        equifax: {
                          type: "object",
                          properties: {
                            score: { type: "integer", description: "300-900" },
                            as_of: { type: "string", nullable: true, description: "YYYY-MM-DD or null" },
                          },
                          required: ["score", "as_of"],
                          additionalProperties: false,
                        },
                        experian: {
                          type: "object",
                          properties: {
                            score: { type: "integer" },
                            as_of: { type: "string", nullable: true },
                          },
                          required: ["score", "as_of"],
                          additionalProperties: false,
                        },
                        transunion: {
                          type: "object",
                          properties: {
                            score: { type: "integer" },
                            as_of: { type: "string", nullable: true },
                          },
                          required: ["score", "as_of"],
                          additionalProperties: false,
                        },
                      },
                      additionalProperties: false,
                    },
                  },
                  required: ["identity", "structured_blob", "credit_scores"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_intake" } },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add funds" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ identity: {}, structured_blob: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { identity?: Record<string, unknown>; structured_blob?: string; credit_scores?: Record<string, unknown> };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI output", identity: {}, structured_blob: "" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize identity: enforce ssn_last4 format, lowercase email, digits-only phone.
    const identity = (parsed.identity || {}) as Record<string, unknown>;
    const cleanIdentity = {
      dob: typeof identity.dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(identity.dob) ? identity.dob : null,
      current_address: typeof identity.current_address === "string" && identity.current_address.trim() ? identity.current_address.trim() : null,
      ssn_last4: typeof identity.ssn_last4 === "string" && /^\d{4}$/.test(identity.ssn_last4) ? identity.ssn_last4 : null,
      phone: typeof identity.phone === "string" ? (identity.phone.replace(/\D/g, "") || null) : null,
      email: typeof identity.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email.trim()) ? identity.email.trim().toLowerCase() : null,
      alternate_addresses: Array.isArray(identity.alternate_addresses)
        ? (identity.alternate_addresses as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [],
    };

    // Sanitize credit_scores: enforce score range and date format.
    const rawScores = (parsed.credit_scores || {}) as Record<string, unknown>;
    const cleanScores: Record<string, { score: number; as_of: string | null }> = {};
    for (const bureau of ["equifax", "experian", "transunion"] as const) {
      const entry = rawScores[bureau] as { score?: unknown; as_of?: unknown } | undefined;
      if (!entry || typeof entry !== "object") continue;
      const score = typeof entry.score === "number" ? Math.round(entry.score) : NaN;
      if (!(score >= 300 && score <= 900)) continue;
      const asOf =
        typeof entry.as_of === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.as_of)
          ? entry.as_of
          : null;
      cleanScores[bureau] = { score, as_of: asOf };
    }

    return new Response(
      JSON.stringify({
        identity: cleanIdentity,
        structured_blob: typeof parsed.structured_blob === "string" ? parsed.structured_blob : "",
        credit_scores: cleanScores,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-intake error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});