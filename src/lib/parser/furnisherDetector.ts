/**
 * Furnisher Detection (B4)
 *
 * Recognises when the SOURCE column of a parsed row refers to a furnisher
 * (creditor / collection agency / lender / servicer) rather than a bureau,
 * data broker, or regulatory body.
 *
 * Triggers (in priority order):
 *   1. Explicit parenthetical tag: "OneMain Financial (furnisher)"
 *   2. Token-pattern match against known furnisher suffix words
 *      (Bank, Financial, Capital, Funding, Acceptance, Auto, Card,
 *       Collections, Recovery, Credit Union, Mortgage, Loan).
 *
 * Returns null when the source string does NOT look like a furnisher; the
 * caller should then fall back to the existing bureau / data-broker source
 * normaliser.
 */

const FURNISHER_TOKEN_PATTERNS: RegExp[] = [
  /\bbank\b/i,
  /\bfinancial\b/i,
  /\bcapital\b/i,
  /\bfunding\b/i,
  /\bacceptance\b/i,
  /\bauto\b/i,
  /\bcard\b/i,
  /\bcollections?\b/i,
  /\brecovery\b/i,
  /\bcredit\s+union\b/i,
  /\bmortgage\b/i,
  /\bloan\b/i,
  /\bservicing\b/i,
  /\bservicer\b/i,
  /\bcreditor\b/i,
  /\bfurnisher\b/i,
  /\blvnv\b/i,
  /\bportfolio\b/i,
];

export interface FurnisherRef {
  name: string;
  account_last4: string | null;
}

/**
 * Try to extract a furnisher name from a source-column string.
 *
 * - Strips any "(furnisher)" tag from the returned name.
 * - Returns the cleaned, trimmed name verbatim (preserving original casing).
 * - account_last4 is captured if the source column itself includes "#1234"
 *   or "(****1234)"; otherwise null. The import pipeline may upgrade it
 *   from the row's account_ref column later.
 */
export function detectFurnisher(rawSource: string): FurnisherRef | null {
  if (!rawSource) return null;
  const cleaned = rawSource.trim();
  if (!cleaned) return null;

  // Strip parenthetical tag and remember whether it explicitly said furnisher
  const explicitFurnisher = /\(\s*furnisher\s*\)/i.test(cleaned);
  const withoutTag = cleaned.replace(/\s*\(\s*furnisher\s*\)\s*/i, ' ').trim();

  // Pull a last-4 if visible inline, e.g. "OneMain #1234" or "Discover (****1234)"
  let last4: string | null = null;
  const last4Match = withoutTag.match(/(?:#|\*{2,}|x{2,})(\d{4})\b/i) || withoutTag.match(/\((\d{4})\)/);
  if (last4Match) last4 = last4Match[1];

  // Strip the last-4 fragment from the display name so we keep "OneMain Financial"
  const displayName = withoutTag
    .replace(/\s*[#(\*xX]+\s*\d{4}\)?\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!displayName) return null;

  if (explicitFurnisher) {
    return { name: displayName, account_last4: last4 };
  }

  // Token-pattern match against known furnisher words
  for (const rx of FURNISHER_TOKEN_PATTERNS) {
    if (rx.test(displayName)) {
      return { name: displayName, account_last4: last4 };
    }
  }

  return null;
}

/**
 * Pull a 4-digit account tail out of the account_ref column, e.g.
 * "(****1234)" or "Acct #1234" or just "1234".
 */
export function extractAccountLast4(accountRef: string | null | undefined): string | null {
  if (!accountRef) return null;
  const m = accountRef.match(/(\d{4})\b/);
  return m ? m[1] : null;
}