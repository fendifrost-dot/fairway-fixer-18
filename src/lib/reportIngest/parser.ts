/**
 * C6 — Phase 1 structured-text parser.
 *
 * Accepts a deliberately-simple line-oriented blob the operator pastes from
 * a bureau report (or a tri-merge column). Format:
 *
 *   ## Bureau: Experian|Equifax|TransUnion|All|TriMerge
 *   ## Score: 612         (optional)
 *   ## ScoreEquifax: 598  (optional, for tri-merge)
 *   - DISCOVER BANK ****1234 | Charge-off | balance: 439 | opened: 2019-08-01
 *   - SYNERGETIC ****0001 | Collection | balance: 49730
 *
 * One row per tradeline. Pipe-separated fields, key:value style. Bureau header
 * may repeat for tri-merge — rows below it belong to that bureau until next
 * header. "All" or "TriMerge" duplicates rows across all three bureaus.
 *
 * This is intentionally restrictive — the operator pastes structured text,
 * not raw OCR. Phase 2 will handle PDF/vision OCR and feed this same parser.
 */

import type {
  ParsedReport,
  ParsedReportScores,
  ParsedReportTradeline,
} from './types';
import type { TradelineBureau } from '@/types/operator';

const BUREAU_ALIASES: Record<string, TradelineBureau | 'all'> = {
  equifax: 'equifax',
  eq: 'equifax',
  experian: 'experian',
  ex: 'experian',
  exp: 'experian',
  transunion: 'transunion',
  tu: 'transunion',
  trans: 'transunion',
  all: 'all',
  trimerge: 'all',
  'tri-merge': 'all',
};

function normBureau(s: string): TradelineBureau | 'all' | null {
  const k = s.trim().toLowerCase();
  return BUREAU_ALIASES[k] ?? null;
}

function extractLast4(name: string): { name: string; last4: string | null } {
  // Match common patterns: ****1234, xxxx1234, ...1234, last 4 digits at end after non-digits
  const m = name.match(/[*xX•·.]{2,}(\d{4})\b/) || name.match(/\b(\d{4})\s*$/);
  if (m) {
    return {
      name: name.replace(m[0], '').trim().replace(/[\s\-_,]+$/, '').trim(),
      last4: m[1],
    };
  }
  return { name: name.trim(), last4: null };
}

function parseAmount(v: string): number | null {
  const cleaned = v.replace(/[$,]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string): string | null {
  const t = v.trim();
  // ISO-ish
  const m = t.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (m) {
    const y = m[1];
    const mm = String(Math.max(1, Math.min(12, Number(m[2])))).padStart(2, '0');
    const dd = String(Math.max(1, Math.min(31, Number(m[3] || '1')))).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

function parseRow(line: string, bureau: TradelineBureau): ParsedReportTradeline | null {
  // Strip leading marker (-, *, •)
  const body = line.replace(/^[\s\-*•]+/, '').trim();
  if (!body) return null;
  const parts = body.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const { name, last4 } = extractLast4(parts[0]);
  if (!name) return null;

  let status: string | null = null;
  let balance: number | null = null;
  let opened: string | null = null;
  let explicitLast4: string | null = null;

  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const kv = seg.match(/^([a-zA-Z][a-zA-Z _-]*)\s*[:=]\s*(.*)$/);
    if (kv) {
      const k = kv[1].trim().toLowerCase().replace(/[\s_-]+/g, '');
      const v = kv[2].trim();
      if (k === 'balance' || k === 'bal') balance = parseAmount(v);
      else if (k === 'opened' || k === 'openeddate' || k === 'opendate') opened = parseDate(v);
      else if (k === 'status') status = v || null;
      else if (k === 'last4' || k === 'account' || k === 'acct') {
        const m = v.match(/(\d{4})/);
        if (m) explicitLast4 = m[1];
      }
    } else if (!status) {
      // First unkeyed segment after name = status
      status = seg;
    }
  }

  return {
    display_name: name,
    account_last4: explicitLast4 ?? last4,
    status_on_bureau: status,
    balance,
    opened_date: opened,
    bureau,
  };
}

/**
 * Parse a structured-text report blob. Pure function — no I/O.
 *
 * Throws when the blob has no recognizable bureau header or rows.
 */
export function parseReportText(blob: string): ParsedReport {
  const lines = blob.split(/\r?\n/);
  const tradelines: ParsedReportTradeline[] = [];
  const scores: ParsedReportScores = {};
  const seenBureaus = new Set<TradelineBureau>();
  let currentBureau: TradelineBureau | 'all' | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Header lines ## Key: Value
    const hdr = line.match(/^#{1,3}\s*([A-Za-z][A-Za-z _-]*?)\s*:\s*(.+?)\s*$/);
    if (hdr) {
      const k = hdr[1].trim().toLowerCase().replace(/[\s_-]+/g, '');
      const v = hdr[2].trim();
      if (k === 'bureau') {
        const nb = normBureau(v);
        if (nb) currentBureau = nb;
        continue;
      }
      if (k === 'score' || k === 'ficoscore') {
        const n = Number(v.replace(/[^\d]/g, ''));
        if (Number.isFinite(n) && n > 0) {
          if (currentBureau === 'all') {
            scores.equifax = scores.equifax ?? n;
            scores.experian = scores.experian ?? n;
            scores.transunion = scores.transunion ?? n;
          } else if (currentBureau) {
            scores[currentBureau] = n;
          }
        }
        continue;
      }
      if (k === 'scoreequifax' || k === 'eqscore') {
        const n = Number(v.replace(/[^\d]/g, ''));
        if (Number.isFinite(n) && n > 0) scores.equifax = n;
        continue;
      }
      if (k === 'scoreexperian' || k === 'exscore') {
        const n = Number(v.replace(/[^\d]/g, ''));
        if (Number.isFinite(n) && n > 0) scores.experian = n;
        continue;
      }
      if (k === 'scoretransunion' || k === 'tuscore') {
        const n = Number(v.replace(/[^\d]/g, ''));
        if (Number.isFinite(n) && n > 0) scores.transunion = n;
        continue;
      }
      continue;
    }

    if (!currentBureau) continue;
    const targets: TradelineBureau[] =
      currentBureau === 'all' ? ['equifax', 'experian', 'transunion'] : [currentBureau];
    for (const b of targets) {
      const row = parseRow(line, b);
      if (row) {
        tradelines.push(row);
        seenBureaus.add(b);
      }
    }
  }

  if (seenBureaus.size === 0 && tradelines.length === 0) {
    throw new Error(
      'No bureau header found. Start the blob with `## Bureau: Experian` (or Equifax / TransUnion / TriMerge).'
    );
  }

  return {
    bureaus: Array.from(seenBureaus),
    tradelines,
    scores,
  };
}