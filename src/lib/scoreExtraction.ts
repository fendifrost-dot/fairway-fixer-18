/**
 * Credit Score Extraction (B6)
 *
 * Pure helpers that detect credit-score statements inside operator narrative
 * lines (typically OUTCOMES OBSERVED rows or intake narrative sentences) and
 * normalize them into { bureau, score, as_of } records.
 *
 * Recognised forms (case-insensitive):
 *   "TransUnion | Score 584 per Jan 12 report"
 *   "Experian | Score 561"
 *   "Equifax score 532 as of 2026-02-09"
 *   "TransUnion: 600 (Jan 2026)"
 *
 * Rules:
 * - Score must be 300–900.
 * - as_of is optional. Returned as YYYY-MM-DD when a full date is parseable;
 *   otherwise null. We do NOT fabricate a day when only month/year is given.
 */

export type ScoreBureau = 'equifax' | 'experian' | 'transunion';

export interface ExtractedScore {
  bureau: ScoreBureau;
  score: number;
  as_of: string | null; // YYYY-MM-DD or null
}

export interface CreditScoresMap {
  equifax?: { score: number; as_of: string | null };
  experian?: { score: number; as_of: string | null };
  transunion?: { score: number; as_of: string | null };
}

const BUREAU_ALIASES: Array<{ rx: RegExp; bureau: ScoreBureau }> = [
  { rx: /\btransunion\b|\btrans\s*union\b|\btu\b/i, bureau: 'transunion' },
  { rx: /\bexperian\b|\bexp\b/i, bureau: 'experian' },
  { rx: /\bequifax\b|\beq\b|\befx\b/i, bureau: 'equifax' },
];

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseAsOf(text: string): string | null {
  // ISO date: 2026-02-09
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const [_, y, m, d] = iso;
    const yy = Number(y), mm = Number(m), dd = Number(d);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return `${y}-${m}-${d}`;
  }

  // "Jan 12, 2026" / "January 12 2026"
  const long = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:,)?\s+(\d{4})\b/);
  if (long) {
    const m = MONTHS[long[1].toLowerCase()];
    const d = Number(long[2]);
    const y = Number(long[3]);
    if (m && d >= 1 && d <= 31) return `${y}-${pad(m)}-${pad(d)}`;
  }

  // "Jan 12" (no year) — skip; we will not infer.

  // "M/D/YYYY" or "MM/DD/YYYY"
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const m = Number(slash[1]), d = Number(slash[2]), y = Number(slash[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${pad(m)}-${pad(d)}`;
  }

  return null;
}

function detectBureau(text: string): ScoreBureau | null {
  for (const { rx, bureau } of BUREAU_ALIASES) {
    if (rx.test(text)) return bureau;
  }
  return null;
}

/**
 * Try to extract a single ExtractedScore from one line of text.
 * Returns null if no score statement is present.
 */
export function extractScoreFromLine(line: string): ExtractedScore | null {
  if (!line) return null;
  // Must reference a credit score concept; avoid hitting random numbers like
  // amounts, account refs, etc.
  if (!/\bscore\b|\bfico\b|\bvantage(?:\s*score)?\b/i.test(line) && !/:\s*\d{3}\b/.test(line)) {
    return null;
  }

  const bureau = detectBureau(line);
  if (!bureau) return null;

  // Find the first 3-digit number in 300–900 that appears after the word
  // "score" (or after a colon/pipe), to reduce false positives like account
  // numbers.
  const candidates: number[] = [];
  const rx = /(?:score|fico|vantage(?:\s*score)?|[:|])\s*[:#]?\s*(\d{3})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(line)) !== null) {
    const n = Number(m[1]);
    if (n >= 300 && n <= 900) candidates.push(n);
  }
  if (candidates.length === 0) return null;

  return {
    bureau,
    score: candidates[0],
    as_of: parseAsOf(line),
  };
}

/**
 * Scan many lines and return the most-recent score per bureau.
 * Lines without an as_of date are kept only if no dated score for that bureau
 * has been seen.
 */
export function extractScoresFromLines(lines: string[]): ExtractedScore[] {
  const best: Partial<Record<ScoreBureau, ExtractedScore>> = {};
  for (const line of lines) {
    const got = extractScoreFromLine(line);
    if (!got) continue;
    const prev = best[got.bureau];
    if (!prev) {
      best[got.bureau] = got;
      continue;
    }
    // Prefer the one with a later as_of date; if neither has a date, keep
    // the first; if only the new one has a date, take it.
    if (got.as_of && (!prev.as_of || got.as_of > prev.as_of)) {
      best[got.bureau] = got;
    }
  }
  return Object.values(best).filter(Boolean) as ExtractedScore[];
}

/**
 * Merge newly extracted scores into an existing CreditScoresMap, keeping the
 * most-recent score per bureau (compared by as_of). Scores without an as_of
 * are ranked below dated scores. Returns the merged map and the list of
 * bureaus that actually changed.
 */
export function mergeCreditScores(
  existing: CreditScoresMap | null | undefined,
  incoming: ExtractedScore[]
): { merged: CreditScoresMap; changed: ScoreBureau[] } {
  const merged: CreditScoresMap = { ...(existing || {}) };
  const changed: ScoreBureau[] = [];
  for (const inc of incoming) {
    const prev = merged[inc.bureau];
    if (!prev) {
      merged[inc.bureau] = { score: inc.score, as_of: inc.as_of };
      changed.push(inc.bureau);
      continue;
    }
    const prevDate = prev.as_of ?? '';
    const incDate = inc.as_of ?? '';
    // Replace if incoming has a strictly newer dated score, or if existing
    // has no date and incoming does, or scores differ and dates tie.
    if (
      (incDate && (!prevDate || incDate > prevDate)) ||
      (!prevDate && incDate)
    ) {
      if (prev.score !== inc.score || prev.as_of !== inc.as_of) changed.push(inc.bureau);
      merged[inc.bureau] = { score: inc.score, as_of: inc.as_of };
    }
  }
  return { merged, changed };
}

export function bureauDisplayName(b: ScoreBureau): string {
  return b === 'transunion' ? 'TransUnion' : b === 'equifax' ? 'Equifax' : 'Experian';
}