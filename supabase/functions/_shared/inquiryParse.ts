export interface ParsedInquiry {
  creditor: string;
  inquiry_date: string | null;
  raw_line: string;
  dispute_as_unauthorized: boolean;
}

const SECTION_END =
  /\n(?:ACCOUNTS|TRADELINES|PUBLIC RECORD|PERSONAL INFORMATION|CREDIT SCORE|EMPLOYMENT|CONSUMER STATEMENT|SUMMARY)/i;

const DATE_CREDITOR_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s*$/;

export function parseInquiriesFromReportText(text: string): ParsedInquiry[] {
  const lower = text.toLowerCase();
  const start = lower.search(/\b(?:hard\s+)?inquiries\b/);
  if (start === -1) return [];

  let section = text.slice(start);
  const endRel = section.slice(120).search(SECTION_END);
  if (endRel > 0) section = section.slice(0, 120 + endRel);

  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: ParsedInquiry[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (/^inquir(y|ies)/i.test(line)) continue;
    if (/^date\b/i.test(line) && /company|creditor|name/i.test(line)) continue;

    const m = line.match(DATE_CREDITOR_RE);
    if (!m) continue;

    const creditor = m[2].replace(/\s+/g, " ").trim();
    if (creditor.length < 2) continue;

    const key = `${m[1]}|${creditor.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      creditor,
      inquiry_date: m[1],
      raw_line: line,
      dispute_as_unauthorized: false,
    });
  }

  return results;
}

export function mergeFlaggedInquiries(
  parsed: ParsedInquiry[],
  flagged: { creditor: string; inquiry_date?: string | null; dispute_as_unauthorized?: boolean }[],
): ParsedInquiry[] {
  if (!flagged.length) return parsed;
  const flagSet = new Set(
    flagged
      .filter((f) => f.dispute_as_unauthorized)
      .map((f) => `${f.inquiry_date ?? ""}|${f.creditor.toLowerCase()}`),
  );
  return parsed.map((p) => ({
    ...p,
    dispute_as_unauthorized: flagSet.has(`${p.inquiry_date ?? ""}|${p.creditor.toLowerCase()}`),
  }));
}

function buildSystemPrompt(letterMode: string, disputeFocus: string): string {
  const framing =
    letterMode === "initial"
      ? `LETTER MODE: INITIAL (first dispute on this topic).
- Do NOT claim a prior dispute was sent, acknowledged, investigated, or that documents were already provided unless explicitly present in the evidence timeline JSON.
- Do NOT use phrases like "you previously acknowledged", "as stated in my prior letter", "I have already provided", or "remains on my file after your investigation" unless a matching response/outcome row exists in evidence.
- Use first-dispute language: identify the inaccuracy, cite what appears on the report, and request investigation/deletion/correction.`
      : `LETTER MODE: FOLLOW-UP (prior dispute correspondence exists in evidence).
- You may reference prior actions/responses ONLY when supported by specific evidence timeline rows (dates, summaries, raw_line).
- Do not invent bureau acknowledgments or investigation outcomes.`;

  const focus =
    disputeFocus === "inquiry"
      ? `DISPUTE FOCUS: HARD INQUIRY / IDENTITY THEFT (FCRA §605B).
- Target unauthorized hard inquiries flagged in the inquiries JSON — NOT tradeline trivia (missing credit limits, minor balance wording).
- Inquiry disputes do not require a tradeline account number.
- Request blocking or removal of unauthorized inquiries per identity-theft procedures when supported by the inputs.`
      : disputeFocus === "tradeline"
        ? `DISPUTE FOCUS: TRADELINE / ACCOUNT ACCURACY.
- Target material reporting errors on accounts (status, balance, dates, re-aging, charge-off inconsistencies).
- Deprioritize trivial formatting issues unless they evidence broader inaccuracy.`
        : `DISPUTE FOCUS: AUTO — choose the most material disputable items in the document (inquiries vs tradelines) based on severity. Prefer unauthorized inquiries over trivial tradeline metadata when both appear.`;

  return `You assist a credit-file dispute professional drafting a bureau letter. You are NOT a lawyer and do not give legal advice.

${framing}

${focus}

Universal rules:
- Use ONLY facts present in the document text, inquiries JSON, evidence timeline JSON, and scheduled tasks JSON. Never invent dates, account numbers, investigation outcomes, FTC reports, or communications.
- NEVER use bracket placeholders or fill-in blanks in draft_letter (no [DATE], [SSN], [ACCOUNT NUMBER], [YOUR NAME], etc.). If a value is unknown, omit the sentence or use generic phrasing without blanks.
- Do NOT include an "Enclosures" or "Attachments" section in draft_letter — standard ID/utility/FTC documents are mailed separately; mention those only in operator_checklist if the operator must verify them.
- Put verification reminders (SSN, DOB, account numbers to confirm, enclosure checks) ONLY in operator_checklist — never in draft_letter.
- If something important is missing, add it to operator_checklist.
- Valid event_kind values in evidence: action, response, outcome, note. Scheduled tasks are planning items, not sworn evidence — cite them cautiously.`;
}

export { buildSystemPrompt };
