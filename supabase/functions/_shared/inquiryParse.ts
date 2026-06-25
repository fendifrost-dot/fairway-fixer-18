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
  has_ftc_report: boolean;
  cfpb_or_ag_task_count: number;
  statutes_scaffold: string[];
  account_identifiers: string[];
  required_strength_elements: string[];
}

function buildMaximumStrengthRules(
  disputeFocus: string,
  history: PromptHistoryContext,
): string {
  const isTradeline = disputeFocus !== "inquiry";
  const hasFtc = history.has_ftc_report;
  const willfulFacts =
    hasFtc &&
    (history.has_reinsertion_signal ||
      history.has_verified_without_docs ||
      history.prior_round_exists);

  const blocks: string[] = [];

  if (hasFtc && isTradeline) {
    blocks.push(`§605B BLOCKING DEMAND (MANDATORY — FTC Identity Theft Report on file; tradeline/account dispute):
- Include a dedicated §605B / 15 U.S.C. §1681c-2 blocking demand for the disputed account(s).
- Demand the bureau BLOCK reporting of the information within **4 business days** (not 30 days).
- Cite all four statutory elements the consumer has satisfied or is providing:
  (1) proof of identity;
  (2) a copy of an identity theft report (cite FTC Report #${history.ftc_identity_theft_report_number ?? "on file"} when number is in inputs);
  (3) identification of the disputed information; and
  (4) a statement that the information does not relate to any transaction by the consumer.
- This §605B block is the highest-leverage element — do not omit or soften into a generic deletion request.`);
  }

  if (isTradeline) {
    blocks.push(`NOT-MY-ACCOUNT STATEMENT (MANDATORY for tradeline disputes):
- The consumer must flatly and unequivocally state they have **no business relationship** with the furnisher and **no liability** for the account.
- This supports §605B blocking and willful-noncompliance framing — use direct language, not hedged "I believe" phrasing.`);
  }

  blocks.push(`METHOD OF VERIFICATION (MANDATORY):
- Demand disclosure under **15 U.S.C. §1681i(a)(6)(B)(iii)** and **§1681i(a)(7)**.
- Require the bureau to describe **how** it verified the item, **name the furnisher** contacted, and provide the **furnisher's contact information** relied upon.
- If prior responses claimed "verified" without documentation (see history digest), state that prior verification was inadequate and demand substantive MOV disclosure.`);

  if (history.has_reinsertion_signal) {
    blocks.push(`REINSERTION / §611(a)(5)(B) (MANDATORY — delete-then-reinsert signal in profile digest):
- State that the tradeline was previously deleted and later reinserted without required notice.
- Demand the **written notice of reinsertion within 5 business days** required by **§611(a)(5)(B) / §1681i(a)(5)(B)** and the **furnisher certification** supporting reinsertion.
- **Explicitly demand production of the certification.**
- **Deletion fallback (MANDATORY — cite the statute explicitly):** If the bureau cannot produce the certification, demand **immediate deletion under §611(a)(5)(A) / 15 U.S.C. §1681i(a)(5)(A)**. Do not imply deletion without naming §1681i(a)(5)(A).`);
  }

  if (willfulFacts) {
    blocks.push(`WILLFUL-NONCOMPLIANCE DAMAGES (MANDATORY — willfulness facts present):
- Put the bureau on explicit notice of liability under **§616, 15 U.S.C. §1681n** for willful noncompliance.
- State available remedies: **statutory damages of $100 to $1,000 per violation**, **punitive damages**, and **attorney's fees and costs**.
- Tie willfulness to specific facts in inputs (e.g., reinserting an FTC-reported previously-deleted account; repeated "verified" responses without documentation; prior dispute rounds ignored).
- Do not rely on *Safeco* alone — state the statutory damages framework directly. *Safeco Ins. Co. v. Burr*, 551 U.S. 47 (2007), may be cited as supporting case law.`);
  }

  blocks.push(`DUAL DEADLINES (MANDATORY — state separately; never collapse into one deadline):
- **§605B block:** within **4 business days** of receipt (when §605B applies).
- **Reinvestigation / deletion confirmation / MOV response:** within **30 days** under §611 / §1681i.
- Use two distinct deadline sentences or numbered demands — not a single "within 30 days" catch-all.`);

  if (history.account_identifiers.length > 0) {
    blocks.push(`ACCOUNT IDENTIFIERS (MANDATORY):
- Reference each disputed tradeline by **specific account identifier** (not furnisher name alone).
- Identifiers from profile digest: ${history.account_identifiers.join("; ")}.
- Use language such as "account ending XXXX" in the Re: line and body.
- When **multiple** tradelines/accounts appear in the profile digest or document, dispute each in the letter body AND add a separate **operator_checklist** line for the operator to confirm each item before mailing (furnisher name + account identifier).`);
  } else {
    blocks.push(`ACCOUNT IDENTIFIERS:
- If account mask/last-4 appears in document text or profile digest, cite it in the Re: line and body. Do not invent account numbers.`);
  }

  blocks.push(`ALWAYS-RETAIN ANCHORS (MANDATORY — include in draft_letter even when adding §605B, MOV, §1681n, and other max-strength content; do NOT drop these to save space):
- **15 U.S.C. §1681e(b)** — duty to follow reasonable procedures to assure maximum possible accuracy of consumer reports.
- **15 U.S.C. §1681s-2(b)** — furnisher duty to investigate and report results to consumer reporting agencies upon notice of dispute.
- Cite both statutes by number in the body (not merely implied). These are non-negotiable baseline duties alongside any blocking or escalation demands.`);

  return blocks.join("\n\n");
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
- Use first-dispute language for round history, BUT still apply all MAXIMUM-STRENGTH REQUIREMENTS below (§605B, not-my-account, MOV, dual deadlines) when FTC report and tradeline facts support them.`
      : `LETTER MODE: FOLLOW-UP / ESCALATION (prior dispute history exists in structured tables or evidence).
- Cite dispute round count + dates from dispute_rounds when present.
- Reference prior bureau_responses (especially "verified" without documentation) to challenge reinvestigation reasonableness under §611 / 15 U.S.C. §1681i(a)(1) and furnisher duties under §623 / §1681s-2(b).
- When FTC Identity Theft Report number is in history digest, cite it and the filing context (do not invent a filing date unless provided).
- Note prior CFPB / state-AG complaints from history or scheduled tasks when present.
- Incorporate case-law anchors: *Cushman v. Trans Union*, 115 F.3d 220 (3d Cir. 1997); *Safeco Ins. Co. v. Burr*, 551 U.S. 47 (2007).
- Do not invent bureau acknowledgments, investigation outcomes, or communications not in inputs.`;

  const focus =
    disputeFocus === "inquiry"
      ? `DISPUTE FOCUS: HARD INQUIRY / IDENTITY THEFT (FCRA §605B).
- Target unauthorized hard inquiries flagged in the inquiries JSON — NOT tradeline trivia (missing credit limits, minor balance wording).
- Inquiry disputes do not require a tradeline account number.
- Request blocking or removal of unauthorized inquiries per identity-theft procedures when supported by the inputs.
- §605B inquiry blocking may apply; do NOT use tradeline-specific "not my account" language for inquiries unless inputs support it.`
      : disputeFocus === "tradeline"
        ? `DISPUTE FOCUS: TRADELINE / ACCOUNT ACCURACY (identity-theft account dispute when FTC report on file).
- Target material reporting errors on accounts (status, balance, dates, re-aging, charge-off inconsistencies, fraudulent reinsertion).
- Weave tradeline_violations and credit_report_violations from profile digest — especially impossible payment progression and mass-replication patterns.
- Apply full §605B blocking demand when FTC report is on file (see MAXIMUM-STRENGTH REQUIREMENTS).
- Deprioritize trivial formatting issues unless they evidence broader inaccuracy.`
        : `DISPUTE FOCUS: AUTO — choose the most material disputable items in the document (inquiries vs tradelines) based on severity. Prefer unauthorized inquiries over trivial tradeline metadata when both appear. When the dispute resolves to a tradeline/account and FTC report is on file, apply full §605B account-blocking requirements.`;

  const escalationHints: string[] = [];
  if (history.prior_round_exists) {
    escalationHints.push(`Prior dispute rounds on file: ${history.prior_round_count}.`);
  }
  if (history.has_verified_without_docs) {
    escalationHints.push(
      "Prior bureau response(s) marked verified without documentation — escalate on §1681i(a)(1) reasonable reinvestigation and demand MOV.",
    );
  }
  if (history.has_reinsertion_signal) {
    escalationHints.push(
      "Delete-then-reinsert signal detected — apply §611(a)(5)(B) notice + certification demand; delete under §611(a)(5)(A) if absent.",
    );
  }
  if (history.ftc_identity_theft_report_number) {
    escalationHints.push(
      `FTC Identity Theft Report # on file: ${history.ftc_identity_theft_report_number}.`,
    );
  }
  if (history.cfpb_or_ag_task_count > 0) {
    escalationHints.push(`${history.cfpb_or_ag_task_count} CFPB/AG-related scheduled task(s) on file.`);
  }

  const maximumStrength = buildMaximumStrengthRules(disputeFocus, history);

  return `You assist a credit-file dispute professional drafting a bureau letter. You are NOT a lawyer and do not give legal advice. Draft for operator/counsel review only.

${framing}

${focus}

${escalationHints.length ? `History signals from file:\n${escalationHints.map((h) => `- ${h}`).join("\n")}\n` : ""}
=== MAXIMUM-STRENGTH REQUIREMENTS (mandatory when applicable — do not omit) ===

${maximumStrength}

=== END MAXIMUM-STRENGTH REQUIREMENTS ===

Required statutory scaffold (incorporate ALL applicable items in draft_letter; do not omit):
${history.statutes_scaffold.map((s) => `- ${s}`).join("\n")}

Deterministic strength floor — draft_letter MUST satisfy these elements (operator will verify):
${history.required_strength_elements.map((e) => `- ${e}`).join("\n")}

Universal rules:
- Use ONLY facts present in the document text, inquiries JSON, history digest, profile digest, evidence timeline JSON, and scheduled tasks JSON. Never invent dates, account numbers, investigation outcomes, FTC reports, or communications.
- NEVER use bracket placeholders or fill-in blanks in draft_letter (no [DATE], [SSN], [ACCOUNT NUMBER], [YOUR NAME], etc.). If a value is unknown, omit the sentence or use generic phrasing without blanks.
- **Enclosures convention:** Do NOT include a separate "Enclosures" or "Attachments" section in draft_letter. List required mailing enclosures in **operator_checklist** (FTC Identity Theft Report copy, government-issued photo ID, proof of address, prior dispute correspondence). You MAY include at most **one** inline sentence such as "Enclosed: [list]" in draft_letter — no multi-line enclosure block.
- Put verification reminders (SSN, DOB, account numbers to confirm, enclosure checks, mailing gates) in **operator_checklist** — not as bracket placeholders in draft_letter.
- **Always retain** explicit citations to **§1681e(b)** (maximum possible accuracy) and **§1681s-2(b)** (furnisher reinvestigation duty) in draft_letter — adding §605B, MOV, or §1681n content must not replace these.
- When profile digest lists multiple disputed tradelines/accounts, include each in the letter AND add one **operator_checklist** confirmation line per item (furnisher + account identifier).
- If something important is missing from inputs, add it to operator_checklist rather than inventing it.
- Valid event_kind values in evidence: action, response, outcome, note. Scheduled tasks are planning items, not sworn evidence — cite them cautiously.`;
}

export { buildSystemPrompt };
