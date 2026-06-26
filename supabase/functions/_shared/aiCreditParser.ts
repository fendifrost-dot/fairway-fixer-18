/**
 * AI-based credit report parser for Credit Guardian.
 *
 * Replaces the brittle regex parser (parseStructuredText) on the primary path:
 * sends the extracted report text to the Lovable AI gateway with the canonical
 * deterministic prompt, then maps the structured JSON onto Guardian's
 * TradelineRow shape so the existing diff / upsert layer is unchanged.
 *
 * The mapper is where the Postgres 22007 "invalid input syntax for type date:
 * 'Closed'" class of bug is killed: every date field is run through coerceDate(),
 * which returns '' for any non-date value instead of passing a status word into
 * a DATE column.
 */

import {
  dedupeTradelineRows,
  normalizeAccountMask,
  normalizeFurnisher,
  type CreditBureau,
  type PaymentGridEntry,
  type TradelineRow,
} from "./tradelineIdentity.ts";
import type { ParseStructuredTextResult } from "./parseStructuredText.ts";
import { GUARDIAN_PARSER_SYSTEM_PROMPT } from "./credit-parser-prompt.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_TEXT_CHARS = 60_000;
const DEFAULT_TIMEOUT_MS = 60_000;

const PLACEHOLDERS = new Set([
  "", "n/a", "na", "none", "null", "unextractable", "-", "—", "not reported",
  "closed", "open", "current", "paid", "unknown",
]);

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Coerce an AI-supplied value into a YYYY-MM-DD string, or '' when it is not a
 * real date. NEVER returns a status word — this is what keeps DATE columns safe.
 */
export function coerceDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (PLACEHOLDERS.has(v.toLowerCase())) return "";

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // MM/DD/YYYY or M/D/YYYY
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  // MM/YYYY or MM-YYYY → first of month
  m = v.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  // YYYY-MM → first of month
  m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  // "Month YYYY" / "Mon YYYY"
  m = v.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mm) return `${m[2]}-${mm}-01`;
  }
  return ""; // bare years, status words, anything else → not a date
}

/** "$16,672" | 16672 | "N/A" → number | null */
export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (PLACEHOLDERS.has(v)) return null;
  const n = parseFloat(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (PLACEHOLDERS.has(v.toLowerCase())) return null;
  return v;
}

export function normalizeBureau(value: unknown): CreditBureau | null {
  if (typeof value !== "string") return null;
  const n = value.toLowerCase();
  if (n.includes("equifax")) return "equifax";
  if (n.includes("experian")) return "experian";
  if (n.includes("trans")) return "transunion";
  return null;
}

function coerceConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1 ? Math.min(value / 100, 1) : Math.max(value, 0);
  }
  if (typeof value === "string") {
    const w = value.toLowerCase();
    if (w === "high") return 0.9;
    if (w === "medium") return 0.6;
    if (w === "low") return 0.4;
    const n = parseFloat(w);
    if (Number.isFinite(n)) return n > 1 ? n / 100 : n;
  }
  return 0.7;
}

function coerceGrid(value: unknown): PaymentGridEntry[] {
  if (!Array.isArray(value)) return [];
  const out: PaymentGridEntry[] = [];
  for (const cell of value) {
    if (!cell || typeof cell !== "object") continue;
    const month = (cell as Record<string, unknown>).month;
    const status = (cell as Record<string, unknown>).status;
    if (typeof month === "string" && typeof status === "string" && month.trim() && status.trim()) {
      out.push({ month: month.trim(), status: status.trim().toUpperCase() });
    }
  }
  return out;
}

function stripFurnisherCode(name: string): string {
  // Drop a trailing parenthetical lender code like "(7805)" / "(D000)".
  return name.replace(/\s*\([0-9A-Z]{3,5}\)\s*$/i, "").trim();
}

interface AiTradeline {
  bureau?: string;
  furnisher?: string;
  account_mask?: string;
  account_type?: string;
  date_opened?: string;
  date_reported?: string;
  balance?: string | number;
  high_balance?: string | number;
  credit_limit?: string | number;
  past_due?: string | number;
  monthly_payment?: string | number;
  account_status?: string;
  pay_status?: string;
  two_year_payment_grid?: unknown;
  remarks?: unknown;
  derogatory_triggers?: unknown;
  confidence?: unknown;
}

function mapTradeline(tl: AiTradeline, fallbackBureau: CreditBureau): TradelineRow | null {
  const furnisherRaw = cleanText(tl.furnisher);
  if (!furnisherRaw) return null; // no creditor name → header/noise, skip
  const furnisher_raw = stripFurnisherCode(furnisherRaw);
  const bureau = normalizeBureau(tl.bureau) ?? fallbackBureau;

  const remarks = Array.isArray(tl.remarks)
    ? (tl.remarks as unknown[]).filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];
  const dispute_flags = Array.isArray(tl.derogatory_triggers)
    ? (tl.derogatory_triggers as unknown[]).filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];

  return {
    furnisher_raw,
    furnisher_normalized: normalizeFurnisher(furnisher_raw),
    bureau,
    account_mask: normalizeAccountMask(cleanText(tl.account_mask) ?? ""),
    date_opened: coerceDate(tl.date_opened),
    date_reported: coerceDate(tl.date_reported) || undefined,
    balance: parseMoney(tl.balance),
    high_balance: parseMoney(tl.high_balance),
    past_due: parseMoney(tl.past_due),
    monthly_payment: parseMoney(tl.monthly_payment),
    loan_type: cleanText(tl.account_type),
    pay_status: cleanText(tl.pay_status),
    account_status: cleanText(tl.account_status),
    remarks,
    two_year_payment_grid: coerceGrid(tl.two_year_payment_grid),
    dispute_flags,
    parse_confidence: coerceConfidence(tl.confidence),
  };
}

export interface AiParseOptions {
  bureau?: string; // target bureau; rows are filtered to it unless "combined"/"all"
  reportDate?: string;
  apiKey: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AiParseResult extends ParseStructuredTextResult {
  inquiries: { bureau: CreditBureau | null; creditor: string; date: string; type: string }[];
  scores: { bureau: CreditBureau | null; score: number | null; model: string | null }[];
  parse_mode: "ai";
}

/**
 * Parse a full credit report's extracted text with the LLM and return rows in
 * Guardian's TradelineRow shape (plus inquiries/scores). Throws on gateway/parse
 * failure so the caller can fall back to the regex parser.
 */
export async function parseCreditReportWithAI(
  text: string,
  opts: AiParseOptions,
): Promise<AiParseResult> {
  const target = (opts.bureau ?? "").toLowerCase();
  const targetBureau = normalizeBureau(target);
  const keepAll = !targetBureau || target === "combined" || target === "all";
  const fallbackBureau: CreditBureau = targetBureau ?? "transunion";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (opts.signal) opts.signal.addEventListener("abort", () => controller.abort());

  let raw: string;
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: GUARDIAN_PARSER_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Parse this credit report text into the JSON contract. ` +
              `${targetBureau ? `Focus bureau: ${targetBureau}. ` : ""}` +
              `Report date (if not found in text): ${opts.reportDate ?? "unknown"}.\n\n` +
              text.slice(0, MAX_TEXT_CHARS),
          },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`AI gateway ${resp.status}: ${body.slice(0, 200)}`);
    }
    // Read text first: a non-JSON 200 otherwise throws an opaque SyntaxError.
    const envelope = await resp.text();
    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = JSON.parse(envelope);
    } catch {
      throw new Error(`AI gateway returned non-JSON envelope: ${envelope.slice(0, 200)}`);
    }
    raw = data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }

  if (!raw.trim()) throw new Error("AI returned an empty parse result");

  let parsed: {
    report_metadata?: { report_date?: string };
    tradelines?: AiTradeline[];
    inquiries?: { bureau?: string; creditor?: string; date?: string; type?: string }[];
    scores?: { bureau?: string; score?: number; model?: string }[];
    warnings?: string[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Some models wrap JSON in ```json fences despite json_object — strip and retry.
    const fenced = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(fenced);
  }

  const warnings: ParseStructuredTextResult["warnings"] = (parsed.warnings ?? [])
    .filter((w): w is string => typeof w === "string")
    .map((w) => ({ line: "", reason: w }));

  let rows: TradelineRow[] = (parsed.tradelines ?? [])
    .map((tl) => mapTradeline(tl, fallbackBureau))
    .filter((r): r is TradelineRow => r !== null);

  if (!keepAll && targetBureau) {
    // Client-side PDF extraction linearizes PrivacyGuard's 3-column tri-merge, so
    // the model's per-row bureau tag is unreliable (a value's source column is
    // lost). This upload is declared to be `targetBureau`'s snapshot, so attribute
    // every extracted tradeline to it rather than dropping rows it mis-tagged.
    for (const r of rows) r.bureau = targetBureau;
    if (rows.length > 0) {
      warnings.push({
        line: "",
        reason: `Attributed ${rows.length} tradeline(s) to ${targetBureau} (per-bureau upload of a tri-merge; column→bureau mapping is not recoverable from extracted text).`,
      });
    }
  }

  const deduped = dedupeTradelineRows(rows);
  if (deduped.length < rows.length) {
    warnings.push({
      line: "",
      reason: `Collapsed ${rows.length - deduped.length} duplicate identity rows.`,
    });
  }

  const inquiries = (parsed.inquiries ?? [])
    .map((i) => ({
      bureau: normalizeBureau(i.bureau),
      creditor: cleanText(i.creditor) ?? "",
      date: coerceDate(i.date),
      type: cleanText(i.type) ?? "unknown",
    }))
    .filter((i) => i.creditor.length > 0);

  const scores = (parsed.scores ?? [])
    .map((s) => ({
      bureau: normalizeBureau(s.bureau),
      score: typeof s.score === "number" && Number.isFinite(s.score) ? s.score : null,
      model: cleanText(s.model),
    }))
    .filter((s) => s.score !== null);

  const bureausSeen = new Set(deduped.map((r) => r.bureau));
  const bureau_detected: AiParseResult["bureau_detected"] =
    bureausSeen.size > 1 ? "tri_merge" : bureausSeen.size === 1 ? [...bureausSeen][0] : null;

  return {
    rows: deduped,
    bureau_detected,
    report_date: coerceDate(parsed.report_metadata?.report_date) || opts.reportDate || null,
    warnings,
    inquiries,
    scores,
    parse_mode: "ai",
  };
}
