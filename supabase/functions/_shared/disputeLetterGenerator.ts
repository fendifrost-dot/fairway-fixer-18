/**
 * Violation detection + max-strength letter assembly (W2).
 */

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
}

export interface StrengthChecklist {
  statutes_invoked: string[];
  contradictions_cited: string[];
  evidence_attached: string[];
  demand_and_deadline: boolean;
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

  const statutes = [...STATUTES_ALL];
  if (input.recipientType === 'collector') {
    statutes.push('15 U.S.C. §1692g — FDCPA validation');
  }

  const body_md = `# Formal Dispute — ${input.letterType}

**To:** ${input.recipientName}
**Re:** ${input.clientName} — ${input.letterType}
**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Dear ${input.recipientName},

Pursuant to the Fair Credit Reporting Act and applicable furnisher duties, I formally dispute the following tradeline(s) as **inaccurate, incomplete, and unverifiable**:

${tradelineList}
${violationSection}
${evidenceSection}

## Statutory Basis

${statutes.map((s) => `- ${s}`).join('\n')}

## Case Law

- *Cushman v. Trans Union*, 115 F.3d 220 (3d Cir. 1997) — reasonable reinvestigation standard
- *Safeco Ins. Co. v. Burr*, 551 U.S. 47 (2007) — willfulness under FCRA
${escalationNote}

## Demand

Within **30 days** of receipt, ${input.recipientType === 'furnisher' ? 'as furnisher of information' : 'as consumer reporting agency'}, you must:

1. Conduct a reasonable reinvestigation of each disputed item;
2. **Delete** all tradelines and late-payment notations that cannot be verified with specific documentary evidence;
3. Provide method-of-verification disclosure identifying the furnisher records relied upon;
4. Correct all pay-history grids to reflect accurate payment status.

Failure to comply will result in escalation to the CFPB${input.cfpbComplaintIds?.length ? ` (Complaint IDs: ${input.cfpbComplaintIds.join(', ')})` : ''}, state regulators, and potential litigation under §1681n/§1681o.

Respectfully,

Continuum Capital Group
Credit Restoration & Consumer Advocacy
`;

  const checklist: StrengthChecklist = {
    statutes_invoked: statutes,
    contradictions_cited: contradictions,
    evidence_attached: input.evidence.map((e) => e.title),
    demand_and_deadline: true,
    score: Math.min(
      100,
      20 +
        (statutes.length >= 8 ? 25 : 10) +
        (contradictions.length > 0 ? 25 : 0) +
        (evidenceQuotes.length > 0 ? 20 : 0) +
        10,
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
  evidenceTitles: string[];
}): StrengthChecklist {
  const contradictions = input.violations.map((v) => v.narrative);
  const statutes = [...STATUTES_ALL];
  let score = 20 + (statutes.length >= 8 ? 25 : 10);
  if (contradictions.length > 0) score += 25;
  if (input.evidenceTitles.length > 0) score += 15;
  if (input.priorRoundExists) score += 10;
  if (input.hasReinsertionSignal) score += 10;
  if (input.hasFtcReport) score += 5;
  return {
    statutes_invoked: statutes,
    contradictions_cited: contradictions,
    evidence_attached: input.evidenceTitles,
    demand_and_deadline: true,
    score: Math.min(100, score),
  };
}
