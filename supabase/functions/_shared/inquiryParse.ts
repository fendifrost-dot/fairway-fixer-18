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

export interface PromptHistoryContext {
  prior_round_count: number;
  prior_round_exists: boolean;
  has_verified_without_docs: boolean;
  has_reinsertion_signal: boolean;
  ftc_identity_theft_report_number: string | null;
  cfpb_or_ag_task_count: number;
  statutes_scaffold: string[];
}

function buildSystemPrompt(
  letterMode: string,
  disputeFocus: string,
  history: PromptHistoryContext,
): string {
  const framing =
    letterMode === "initial"
      ? `LETTER MODE: INITIAL (first dispute on this topic).
- Do NOT claim a prior dispute was sent, acknowledged, investigated, or that documents were already provided unless explicitly present in the history digest or evidence timeline JSON.
- Do NOT use phrases like "you previously acknowledged", "as stated in my prior letter", "I have already provided", or "remains on my file after your investigation" unless supported by history digest rows.
- Use first-dispute language: identify the inaccuracy, cite what appears on the report, and request investigation/deletion/correction.`
      : `LETTER MODE: FOLLOW-UP / ESCALATION (prior dispute history exists in structured tables or evidence).
- Cite dispute round count + dates from dispute_rounds when present.
- Reference prior bureau_responses (especially "verified" without documentation) to challenge reinvestigation reasonableness under §611 / 15 U.S.C. §1681i(a)(1) and furnisher duties under §623 / §1681s-2(b).
- If delete-then-reinsert is signaled in profile digest (absent_in_latest then present again), demand compliance with §611(a)(5)(B) written notice within 5 business days and furnisher certification — or re-deletion.
- When FTC Identity Theft Report number is in history digest, cite it and the filing context (do not invent a filing date unless provided).
- Note prior CFPB / state-AG complaints from history or scheduled tasks when present; repeated failures may support willful noncompliance framing under §1681n (state as escalation basis, not a legal conclusion).
- Incorporate case-law anchors: *Cushman v. Trans Union*, 115 F.3d 220 (3d Cir. 1997); *Safeco Ins. Co. v. Burr*, 551 U.S. 47 (2007).
- Do not invent bureau acknowledgments, investigation outcomes, or communications not in inputs.`;

  const focus =
    disputeFocus === "inquiry"
      ? `DISPUTE FOCUS: HARD INQUIRY / IDENTITY THEFT (FCRA §605B).
- Target unauthorized hard inquiries flagged in the inquiries JSON — NOT tradeline trivia (missing credit limits, minor balance wording).
- Inquiry disputes do not require a tradeline account number.
- Request blocking or removal of unauthorized inquiries per identity-theft procedures when supported by the inputs.`
      : disputeFocus === "tradeline"
        ? `DISPUTE FOCUS: TRADELINE / ACCOUNT ACCURACY.
- Target material reporting errors on accounts (status, balance, dates, re-aging, charge-off inconsistencies).
- Weave tradeline_violations and credit_report_violations from profile digest — especially impossible payment progression and mass-replication patterns.
- Deprioritize trivial formatting issues unless they evidence broader inaccuracy.`
        : `DISPUTE FOCUS: AUTO — choose the most material disputable items in the document (inquiries vs tradelines) based on severity. Prefer unauthorized inquiries over trivial tradeline metadata when both appear.`;

  const escalationHints: string[] = [];
  if (history.prior_round_exists) {
    escalationHints.push(`Prior dispute rounds on file: ${history.prior_round_count}.`);
  }
  if (history.has_verified_without_docs) {
    escalationHints.push("Prior bureau response(s) marked verified — challenge adequacy of documentation.");
  }
  if (history.has_reinsertion_signal) {
    escalationHints.push("Delete-then-reinsert signal detected on tradeline profile — apply §611(a)(5)(B) framing.");
  }
  if (history.ftc_identity_theft_report_number) {
    escalationHints.push(`FTC Identity Theft Report # on file: ${history.ftc_identity_theft_report_number}.`);
  }
  if (history.cfpb_or_ag_task_count > 0) {
    escalationHints.push(`${history.cfpb_or_ag_task_count} CFPB/AG-related scheduled task(s) on file.`);
  }

  return `You assist a credit-file dispute professional drafting a bureau letter. You are NOT a lawyer and do not give legal advice.

${framing}

${focus}

${escalationHints.length ? `History signals from file:\n${escalationHints.map((h) => `- ${h}`).join("\n")}\n` : ""}
Required statutory scaffold (incorporate relevant items in draft_letter; do not omit applicable FCRA bases):
${history.statutes_scaffold.map((s) => `- ${s}`).join("\n")}

Universal rules:
- Use ONLY facts present in the document text, inquiries JSON, history digest, profile digest, evidence timeline JSON, and scheduled tasks JSON. Never invent dates, account numbers, investigation outcomes, FTC reports, or communications.
- NEVER use bracket placeholders or fill-in blanks in draft_letter (no [DATE], [SSN], [ACCOUNT NUMBER], [YOUR NAME], etc.). If a value is unknown, omit the sentence or use generic phrasing without blanks.
- Do NOT include an "Enclosures" or "Attachments" section in draft_letter — standard ID/utility/FTC documents are mailed separately; mention those only in operator_checklist if the operator must verify them.
- Put verification reminders (SSN, DOB, account numbers to confirm, enclosure checks, mailing gates) ONLY in operator_checklist — never in draft_letter.
- Include a clear 30-day reinvestigation/deletion demand where appropriate, consistent with the deterministic generator scaffold.
- If something important is missing, add it to operator_checklist.
- Valid event_kind values in evidence: action, response, outcome, note. Scheduled tasks are planning items, not sworn evidence — cite them cautiously.`;
}

export { buildSystemPrompt };
