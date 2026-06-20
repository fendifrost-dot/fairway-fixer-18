/**
 * Tradeline violation + data-quality detection (mirrors disputeLetterGenerator server logic).
 */

export interface PaymentGridEntry {
  month: string;
  status: string;
}

export interface TradelineForAnalysis {
  id?: string;
  furnisher_raw: string;
  account_mask?: string;
  date_opened?: string;
  balance?: number | null;
  pay_status?: string;
  account_status?: string;
  two_year_payment_grid?: PaymentGridEntry[];
}

export interface TradelineViolation {
  type: string;
  narrative: string;
  severity?: string;
  tradeline_id?: string;
}

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

function detectMassReplication(tradelines: TradelineForAnalysis[]): string | null {
  if (tradelines.length < 3) return null;
  const patterns = tradelines.map((t) => {
    const grid = t.two_year_payment_grid ?? [];
    return grid
      .filter((g) => ['30', '60', '90', '120'].includes(g.status.toUpperCase()))
      .map((g) => `${g.month}:${g.status}`)
      .join('|');
  });
  const unique = new Set(patterns.filter(Boolean));
  if (unique.size === 1 && patterns[0]) {
    return `Mass-replicated identical derogatory pattern across ${tradelines.length} separate tradelines of the same furnisher — signature of systemic data corruption during servicer transfer, not independent defaults.`;
  }
  return null;
}

function detectDataQualityAnomaly(tl: TradelineForAnalysis): string | null {
  const statusText = `${tl.account_status ?? ''} ${tl.pay_status ?? ''}`.toLowerCase();
  const balance = tl.balance ?? 0;
  const grid = tl.two_year_payment_grid ?? [];
  const hasGrid = grid.length > 0;
  const neverLate =
    hasGrid &&
    grid.every((g) => {
      const s = g.status.toUpperCase();
      return s === 'OK' || s === 'CURRENT' || s === '—' || s === '-' || s === 'C';
    });

  const derogatoryStatus =
    statusText.includes('unrated') ||
    statusText.includes('bankruptcy') ||
    statusText.includes('charge') ||
    statusText.includes('collection');

  if (derogatoryStatus && balance === 0 && (neverLate || !hasGrid)) {
    const label = tl.account_status || tl.pay_status || 'derogatory status';
    return `Data-quality anomaly: "${label}" with $0 balance and no supporting late-payment history — inconsistent Metro 2 coding that may indicate wrongful derogatory reporting.`;
  }

  return null;
}

export function analyzeTradelineViolations(tradelines: TradelineForAnalysis[]): TradelineViolation[] {
  const violations: TradelineViolation[] = [];

  for (const tl of tradelines) {
    const grid = tl.two_year_payment_grid ?? [];
    const impossible = detectImpossibleProgression(grid);
    if (impossible) {
      violations.push({
        type: 'impossible_payment_progression',
        narrative: `${tl.furnisher_raw} (${tl.account_mask ?? 'acct'}): ${impossible}`,
        severity: 'high',
        tradeline_id: tl.id,
      });
    }

    const dataQuality = detectDataQualityAnomaly(tl);
    if (dataQuality) {
      violations.push({
        type: 'data_quality_anomaly',
        narrative: `${tl.furnisher_raw} (${tl.account_mask ?? 'acct'}): ${dataQuality}`,
        severity: 'medium',
        tradeline_id: tl.id,
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

export function buildBaselineSummary(
  bureau: string,
  reportDate: string,
  tradelineCount: number,
  violations: TradelineViolation[],
): string {
  const high = violations.filter((v) => v.severity === 'high').length;
  const medium = violations.filter((v) => v.severity === 'medium').length;
  return [
    `**${bureau.charAt(0).toUpperCase()}${bureau.slice(1)} report — ${reportDate}**`,
    '',
    `- Tradelines analyzed: **${tradelineCount}**`,
    `- Violations flagged: **${violations.length}** (${high} high, ${medium} medium)`,
    violations.length > 0
      ? '- Review flagged items before drafting dispute letters.'
      : '- No automatic violations detected; operator may still dispute on other grounds.',
  ].join('\n');
}

export function buildLetterSuggestions(violations: TradelineViolation[]): {
  label: string;
  letter_type: string;
  recipient_type: 'cra' | 'furnisher';
  recipient_name: string;
  rationale: string;
}[] {
  const suggestions: {
    label: string;
    letter_type: string;
    recipient_type: 'cra' | 'furnisher';
    recipient_name: string;
    rationale: string;
  }[] = [];

  if (violations.some((v) => v.type === 'impossible_payment_progression' || v.type === 'mass_replication')) {
    suggestions.push({
      label: 'MOV / verify or delete',
      letter_type: 'Method-of-Verification Demand',
      recipient_type: 'cra',
      recipient_name: 'Credit Bureau',
      rationale: 'Impossible payment grid or mass-replication patterns require bureau verification under §1681i.',
    });
  }

  if (violations.some((v) => v.type === 'data_quality_anomaly')) {
    suggestions.push({
      label: 'Furnisher §1681s-2 dispute',
      letter_type: 'Furnisher Direct Dispute',
      recipient_type: 'furnisher',
      recipient_name: 'Furnisher',
      rationale: 'Inconsistent account status vs. balance/payment history — furnisher accuracy duty under §1681s-2(a)(1)(A).',
    });
  }

  if (violations.length > 0 && suggestions.length === 0) {
    suggestions.push({
      label: 'Bureau dispute',
      letter_type: 'Bureau Dispute',
      recipient_type: 'cra',
      recipient_name: 'Credit Bureau',
      rationale: 'Flagged violations warrant bureau reinvestigation under §1681i.',
    });
  }

  return suggestions;
}
