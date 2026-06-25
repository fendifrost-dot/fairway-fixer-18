/**
 * Violation detection + max-strength letter assembly (W2).
 */

import {
  buildScenarioStrengthBundle,
  type ScenarioType,
} from "./letterStrengthBlocks.ts";

export interface PaymentGridEntry {
  month: string;
  status: string;
}

export interface TradelineForLetter {
  id?: string;
  furnisher_raw: string;
  account_mask?: string;
  date_opened?: string;
  balance?: number | null;
  two_year_payment_grid?: PaymentGridEntry[];
}

export interface LetterEvidence {
  id?: string;
  title: string;
  quote?: string;
}

export interface LetterViolation {
  type: string;
  narrative: string;
  severity?: string;
}

export interface DisputeLetterInput {
  clientName: string;
  recipientType: 'cra' | 'furnisher' | 'collector' | 'regulator';
  recipientName: string;
  letterType: string;
  tradelines: TradelineForLetter[];
  violations: LetterViolation[];
  evidence: LetterEvidence[];
  priorRoundExists?: boolean;
  cfpbComplaintIds?: string[];
  /** Explicit §4 scenario; derived from recipientType + FTC report when omitted. */
  scenarioType?: ScenarioType;
  /** FTC Identity Theft Report number, when on file (enables identity-theft scenarios + enclosures line). */
  ftcReportNumber?: string | null;
}

/**
 * Derive the §4 scenario when the caller does not pass one explicitly.
 * Honors the §0 guardrail: a CRA dispute is only identity-theft when an FTC
 * report is on file; otherwise it is the accuracy/reinsertion path.
 */
export function deriveScenarioType(
  recipientType: DisputeLetterInput['recipientType'],
  hasFtcReport: boolean,
): ScenarioType {
  if (recipientType === 'furnisher' || recipientType === 'collector') return 'furnisher';
  // cra / regulator
  return hasFtcReport ? 'cra_account_idtheft' : 'cra_reinsertion_or_accuracy';
}

export interface StrengthChecklist {
  statutes_invoked: string[];
  contradictions_cited: string[];
  evidence_attached: string[];
  demand_and_deadline: boolean;
  /** Elements the draft must include given file context — operator verifies before mailing. */
  required_strength_elements: string[];
  score: number;
}

export const STATUTES_ALL = [
  '15 U.S.C. §1681i(a)(1) — reasonable reinvestigation',
  '15 U.S.C. §1681i(a)(5)(A) — delete unverifiable information',
  '15 U.S.C. §1681i(a)(6)-(7) — method of verification',
  '15 U.S.C. §1681e(b) — maximum possible accuracy',
  '15 U.S.C. §1681s-2(a)(1)(A) — furnisher accuracy duty',
  '15 U.S.C. §1681s-2(a)(2) — duty to correct and update',
  '15 U.S.C. §1681s-2(b) — furnisher reinvestigation duty',
  '15 U.S.C. §1681c(a) — accuracy of historical fields',
  '15 U.S.C. §1681n / §1681o — willful and negligent noncompliance',
  'Metro 2 / CDIA format compatibility',
];

function detectImpossibleProgression(grid: PaymentGridEntry[]): string | null {
  const delinq = ['30', '60', '90', '120'];
  for (let i = 0; i < grid.length; i++) {
    const status = grid[i].status.toUpperCase();
    if (!delinq.includes(status)) continue;
    const prev = i > 0 ? grid[i - 1].status.toUpperCase() : 'OK';
    const next = i < grid.length - 1 ? grid[i + 1].status.toUpperCase() : 'OK';
    const level = parseInt(status, 10);
    if (prev === 'OK' && next === 'OK') {
      return `Impossible payment progression: isolated ${status}-day late at ${grid[i].month} flanked by current (OK) months with no antecedent 30-day late — logically impossible under Metro 2.`;
    }
    if (level >= 60 && prev === 'OK') {
      return `Impossible payment progression: ${status}-day delinquency at ${grid[i].month} without prior 30-day late.`;
    }
  }
  return null;
}

function detectMassReplication(tradelines: TradelineForLetter[]): string | null {
  if (tradelines.length < 3) return null;
  const patterns = tradelines.map((t) => {
    const grid = t.two_year_payment_grid ?? [];
    return grid.filter((g) => ['30', '60', '90', '120'].includes(g.status.toUpperCase()))
      .map((g) => `${g.month}:${g.status}`)
      .join('|');
  });
  const unique = new Set(patterns.filter(Boolean));
  if (unique.size === 1 && patterns[0]) {
    return `Mass-replicated identical derogatory pattern across ${tradelines.length} separate tradelines of the same furnisher — signature of systemic data corruption during servicer transfer, not independent defaults.`;
  }
  return null;
}

export function analyzeTradelineViolations(tradelines: TradelineForLetter[]): LetterViolation[] {
  const violations: LetterViolation[] = [];

  for (const tl of tradelines) {
    const grid = tl.two_year_payment_grid ?? [];
    const impossible = detectImpossibleProgression(grid);
    if (impossible) {
      violations.push({
        type: 'impossible_payment_progression',
        narrative: `${tl.furnisher_raw} (${tl.account_mask ?? 'acct'}): ${impossible}`,
        severity: 'high',
      });
    }
  }

  const massReplication = detectMassReplication(tradelines);
  if (massReplication) {
    violations.push({
      type: 'mass_replication',
      narrative: massReplication,
      severity: 'high',
    });
  }

  return violations;
}

export function buildDisputeLetterBody(input: DisputeLetterInput): {
  body_md: string;
  statutes: string[];
  strength_checklist: StrengthChecklist;
} {
  const autoViolations = analyzeTradelineViolations(input.tradelines);
  const allViolations = [...input.violations, ...autoViolations];

  if (input.tradelines.length === 0 && allViolations.length === 0) {
    throw new Error('NEEDS_REPORT: Cannot generate letter without tradeline data or violations.');
  }

  const contradictions = allViolations.map((v) => v.narrative);
  const evidenceQuotes = input.evidence.filter((e) => e.quote);

  const escalationNote = input.priorRoundExists
    ? '\n\n**Escalation notice:** A prior dispute round and/or CFPB complaint exists for these items. This letter adopts reinsertion / method-of-verification / willful-noncompliance framing pursuant to prior non-responsive verification.'
    : '';

  const tradelineList = input.tradelines
    .map(
      (t) =>
        `- **${t.furnisher_raw}** (acct ${t.account_mask ?? '—'}, opened ${t.date_opened ?? '—'})`,
    )
    .join('\n');

  const violationSection =
    contradictions.length > 0
      ? `\n\n## Data-Integrity Contradictions\n\n${contradictions.map((c) => `- ${c}`).join('\n')}`
      : '';

  const evidenceSection =
    evidenceQuotes.length > 0
      ? `\n\n## Supporting Evidence\n\n${evidenceQuotes
          .map((e) => `- **${e.title}:** "${e.quote}"`)
          .join('\n')}`
      : '';

  const hasFtcReport = Boolean(input.ftcReportNumber);
  const scenario = input.scenarioType ?? deriveScenarioType(input.recipientType, hasFtcReport);
  const bundle = buildScenarioStrengthBundle(scenario, input.recipientName);
  const isFurnisher = scenario === 'furnisher';

  const statutes = [...bundle.statute_stack];
  if (input.recipientType === 'collector') {
    statutes.push('15 U.S.C. § 1692g — FDCPA validation');
  }

  const reCite =
    scenario === 'cra_account_idtheft'
      ? '15 U.S.C. § 1681c-2 (§605B)'
      : scenario === 'cra_inquiry'
        ? '15 U.S.C. § 1681b & § 1681c-2'
        : scenario === 'furnisher'
          ? '15 U.S.C. § 1681s-2'
          : '15 U.S.C. § 1681e(b) & § 1681i';

  const firstTl = input.tradelines[0];
  const itemIdentifier = firstTl
    ? `${firstTl.furnisher_raw}${firstTl.account_mask ? `, Account No. ending ${firstTl.account_mask}` : ''}`
    : input.letterType;

  const roleClause = isFurnisher ? 'as a furnisher of information' : 'as a consumer reporting agency';

  // Numbered demand (§1 item 8) — permanent deletion + written confirmation,
  // scenario-correct. CRA letters append the reinsertion trap.
  const demandItems: string[] = isFurnisher
    ? [
        `cease furnishing and ${bundle.permanent_deletion_demand};`,
        'conduct the reasonable investigation required by 15 U.S.C. § 1681s-2(b) and report the corrected results to every consumer reporting agency to which you furnished the information;',
        'provide written confirmation of the action taken.',
      ]
    : [
        `${bundle.permanent_deletion_demand};`,
        'notify the furnisher of the deletion and direct it not to re-report the information;',
        'provide method-of-verification disclosure under 15 U.S.C. § 1681i(a)(6)(B)(iii) and § 1681i(a)(7), identifying how the item was verified and the furnisher records relied upon;',
        'provide written confirmation of the action taken.',
      ];

  const dataBreachSection = bundle.data_breach_paragraph
    ? `\n\n${bundle.data_breach_paragraph}`
    : '';

  const enclosuresLine = hasFtcReport
    ? `\n\nEnclosures: FTC Identity Theft Report No. ${input.ftcReportNumber}; government-issued identification; proof of current address.`
    : '';

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const body_md = `**${bundle.certified_mail_header}**

${input.clientName}

${dateStr}

${input.recipientName}

**RE: FORMAL DEMAND — ${reCite} — ${itemIdentifier}**

To Whom It May Concern:

${bundle.formal_demand_opening} I dispute the item${input.tradelines.length === 1 ? '' : 's'} identified above and demand ${isFurnisher ? 'correction and permanent deletion' : 'a block and permanent deletion'} of the information.

${tradelineList}${dataBreachSection}${violationSection}${evidenceSection}

${bundle.controlling_statute_quote}

## Statutory Basis

${statutes.map((s) => `- ${s}`).join('\n')}

## Case Law

${bundle.case_law.map((c) => `- ${c}`).join('\n')}${escalationNote}

${bundle.liability_notice}

## Demand

I therefore demand that you, ${roleClause}:

${demandItems.map((d, i) => `${i + 1}. ${d}`).join('\n')}
${bundle.reinsertion_trap ? `\n${bundle.reinsertion_trap}` : ''}

${bundle.reservation_of_rights}${input.cfpbComplaintIds?.length ? ` Failure to comply will be escalated to the CFPB (Complaint IDs: ${input.cfpbComplaintIds.join(', ')}) and state regulators.` : ''}

Sincerely,

${input.clientName}${enclosuresLine}
`;

  const requiredStrengthElements = [
    'Certified-mail header line',
    'Formal-demand opening ("formal demand, not a routine dispute")',
    'Controlling statute quoted + deadline clock',
    'Scenario-correct case law',
    'Liability notice (§1681n + §1681o + preservation)',
    'Numbered demand with permanent deletion + written confirmation',
    'Reservation of rights',
  ];
  if (bundle.data_breach_paragraph) requiredStrengthElements.push('Data-breach paragraph (identity-theft basis)');
  if (bundle.reinsertion_trap) requiredStrengthElements.push('Reinsertion trap (§1681i(a)(5)(B))');
  if (hasFtcReport) requiredStrengthElements.push('Enclosures line (FTC report on file)');

  const checklist: StrengthChecklist = {
    statutes_invoked: statutes,
    contradictions_cited: contradictions,
    evidence_attached: input.evidence.map((e) => e.title),
    demand_and_deadline: true,
    required_strength_elements: requiredStrengthElements,
    score: Math.min(
      100,
      20 +
        (statutes.length >= 4 ? 25 : 10) +
        (contradictions.length > 0 ? 20 : 0) +
        (evidenceQuotes.length > 0 ? 15 : 0) +
        (bundle.data_breach_paragraph ? 5 : 0) +
        15,
    ),
  };

  return { body_md, statutes, strength_checklist: checklist };
}

/** Deterministic strength floor for Response Analyzer (no full letter assembly). */
export function buildAnalyzerStrengthFloor(input: {
  violations: LetterViolation[];
  priorRoundExists: boolean;
  hasReinsertionSignal: boolean;
  hasFtcReport: boolean;
  hasVerifiedWithoutDocs: boolean;
  isTradelineDispute: boolean;
  evidenceTitles: string[];
  accountIdentifiers: string[];
}): StrengthChecklist {
  const contradictions = input.violations.map((v) => v.narrative);
  const statutes = [...STATUTES_ALL];
  const required: string[] = [];

  required.push(
    "Method-of-verification demand: describe how verified, name furnisher, provide furnisher contact (§1681i(a)(6)(B)(iii), §1681i(a)(7))",
  );
  required.push(
    "Dual deadlines stated separately: §605B block within 4 business days (when applicable); reinvestigation/deletion confirmation within 30 days",
  );
  required.push(
    "Explicit §1681e(b) maximum-possible-accuracy citation in draft_letter (always — do not drop for space)",
  );
  required.push(
    "Explicit §1681s-2(b) furnisher reinvestigation-duty citation in draft_letter (always — do not drop for space)",
  );

  if (input.isTradelineDispute) {
    required.push(
      "Unequivocal not-my-account statement: no business relationship with furnisher and no liability for the account",
    );
  }

  if (input.accountIdentifiers.length > 0) {
    required.push(
      `Account identifier(s) in letter body: ${input.accountIdentifiers.join("; ")}`,
    );
  }

  if (input.hasFtcReport && input.isTradelineDispute) {
    statutes.unshift(
      "15 U.S.C. §1681c-2 (§605B) — block identity-theft information within 4 business days",
    );
    required.push(
      "§605B blocking demand (15 U.S.C. §1681c-2): block reporting within 4 business days with four elements — proof of identity, identity theft report, identification of item, statement information does not relate to any transaction by the consumer",
    );
  }

  if (input.hasReinsertionSignal) {
    required.push(
      "§611(a)(5)(B) / §1681i(a)(5)(B): demand written reinsertion notice + furnisher certification",
    );
    required.push(
      "Explicit deletion remedy: cite §611(a)(5)(A) / 15 U.S.C. §1681i(a)(5)(A) if certification not produced",
    );
  }

  const willfulFacts =
    input.hasFtcReport &&
    (input.hasReinsertionSignal || input.hasVerifiedWithoutDocs || input.priorRoundExists);
  if (willfulFacts) {
    required.push(
      "§1681n willful-noncompliance notice (§616): statutory damages $100–$1,000 per violation, punitive damages, attorney's fees — not merely case-law citation",
    );
  }

  if (input.accountIdentifiers.length > 1) {
    required.push(
      `operator_checklist: confirm each disputed item before mailing — ${input.accountIdentifiers.join("; ")}`,
    );
  }

  if (input.hasFtcReport && input.isTradelineDispute) {
    required.push(
      "operator_checklist: confirm enclosures mailed (FTC Identity Theft Report copy, government photo ID, proof of address)",
    );
  }

  let score = 10;
  if (statutes.length >= 9) score += 12;
  if (contradictions.length > 0) score += 12;
  if (input.evidenceTitles.length > 0) score += 8;
  if (input.priorRoundExists) score += 6;
  if (input.hasReinsertionSignal) score += 6;
  if (input.hasFtcReport && input.isTradelineDispute) score += 10;
  if (input.isTradelineDispute) score += 4;
  if (input.accountIdentifiers.length > 0) score += 4;
  if (willfulFacts) score += 6;
  score += 8; // MOV + §1681e(b) + §1681s-2(b) baseline

  return {
    statutes_invoked: statutes,
    contradictions_cited: contradictions,
    evidence_attached: input.evidenceTitles,
    demand_and_deadline: true,
    required_strength_elements: required,
    score: Math.min(100, score),
  };
}
