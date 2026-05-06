/**
 * C5 — Pure routing & template-selection logic for dispute letters.
 *
 * Lives outside the edge function so it can be unit-tested in vitest.
 * The edge function re-implements the bits it needs against Deno-side
 * data, but the suggestion logic is shared verbatim.
 */

import type { DisputeLetterType, RoundContext } from './types';

/**
 * Suggest the most useful letter_type for a given round, given:
 *  - round.status
 *  - round.submitted_at
 *  - whether any verified/updated bureau states exist on this round
 *  - whether any "automated_reverification" signals are attached
 *
 * Operators can override; this is just the default highlighted in the menu.
 */
export interface SuggestionInputs {
  round: Pick<RoundContext, 'status' | 'submitted_at'>;
  todayMs?: number;
  hasVerifiedItems: boolean;
  hasAutomatedReverificationSignal: boolean;
  hasFurnisherRenameSignal: boolean;
  hasPostRoundNewHarmSignal: boolean;
}

export function suggestLetterTypeForRound(input: SuggestionInputs): DisputeLetterType {
  const today = input.todayMs ?? Date.now();

  // 1. Verified items present (with or without a Cushman signal) → MOV.
  if (input.hasVerifiedItems || input.hasAutomatedReverificationSignal) {
    return 'verify_or_delete';
  }

  // 2. Furnisher rename → MOV w/ §1681c(c)(1) emphasis (still a verify_or_delete).
  if (input.hasFurnisherRenameSignal) {
    return 'verify_or_delete';
  }

  // 3. Mailed/awaiting >30d with no response → overdue violation.
  if (
    (input.round.status === 'mailed' || input.round.status === 'awaiting_response') &&
    input.round.submitted_at
  ) {
    const submittedMs = new Date(input.round.submitted_at).getTime();
    if (Number.isFinite(submittedMs) && today - submittedMs > 30 * 86400000) {
      return 'overdue_violation';
    }
  }

  // 4. New post-round harm → kick a fresh round_n_initial for next round.
  if (input.hasPostRoundNewHarmSignal) {
    return 'round_n_initial';
  }

  // 5. Default for planning rounds.
  return 'round_n_initial';
}

/**
 * Returns the canonical FCRA citation list for a given letter_type.
 * Used by the edge function template builder.
 */
export function citationsForLetterType(t: DisputeLetterType): string[] {
  switch (t) {
    case 'round_n_initial':
      return ['15 U.S.C. § 1681i (reinvestigation)'];
    case 'verify_or_delete':
      return [
        '15 U.S.C. § 1681i(a)(7) (method of verification)',
        '15 U.S.C. § 1681i(a)(5)(A)(i) (deletion if not reverified)',
        'Cushman v. TransUnion Corp., 115 F.3d 220 (3d Cir. 1997)',
      ];
    case 'overdue_violation':
      return [
        '15 U.S.C. § 1681i(a)(1) (30-day investigation window)',
        '15 U.S.C. § 1681i(a)(5)(A)(i) (deletion required)',
      ];
    case 'data_broker_followup':
      return [
        '15 U.S.C. § 1681e(b) (maximum possible accuracy)',
        '15 U.S.C. § 1681i (reinvestigation)',
      ];
    case 'furnisher_direct':
      return [
        '15 U.S.C. § 1681s-2(b) (furnisher duties on notice of dispute)',
        '15 U.S.C. § 1681c(c)(1) (re-aging / obsolete reinsertion)',
      ];
  }
}

/**
 * Slugify a name for storage path purposes.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

export function buildStoragePath(
  clientId: string,
  roundNumber: number,
  letterType: DisputeLetterType,
  recipientSlug: string,
  date: Date = new Date()
): string {
  const iso = date.toISOString().slice(0, 10);
  return `${clientId}/${roundNumber}/${letterType}-${recipientSlug}-${iso}.docx`;
}

/**
 * Light targeting helpers — pure functions over already-fetched arrays.
 * Used by the edge function and exposed for tests.
 */
export interface TLForTargeting {
  id: string;
  display_name: string;
  account_last4: string | null;
  balance: number | null;
  opened_date: string | null;
}

export interface BureauStateForTargeting {
  tradeline_id: string;
  bureau: string;            // 'equifax' | 'experian' | 'transunion'
  present: boolean;
  status_on_bureau: string | null;
}

export interface EventForTargeting {
  id: string;
  category: string;
  source: string | null;
  tradeline_id: string | null;
  round_id: string | null;
}

/** Bureau name normalization between EventSource (PascalCase) and tradeline bureau enum (lowercase). */
export function bureauKey(b: string): string {
  return b.toLowerCase().replace(/\s+/g, '');
}

/**
 * Targets for round_n_initial — tradelines present on the bureau that have NOT
 * already been the subject of an action event in this round.
 */
export function pickRoundInitialTargets(args: {
  bureau: string;
  tradelines: TLForTargeting[];
  states: BureauStateForTargeting[];
  events: EventForTargeting[];
  round_id: string;
}): TLForTargeting[] {
  const bk = bureauKey(args.bureau);
  const presentIds = new Set(
    args.states.filter(s => bureauKey(s.bureau) === bk && s.present).map(s => s.tradeline_id)
  );
  const alreadyDisputedIds = new Set(
    args.events
      .filter(e => e.round_id === args.round_id && e.category === 'Action' && e.tradeline_id)
      .map(e => e.tradeline_id as string)
  );
  return args.tradelines.filter(t => presentIds.has(t.id) && !alreadyDisputedIds.has(t.id));
}

/**
 * Targets for verify_or_delete — tradelines whose status_on_bureau on this
 * bureau is in the "verified / updated" bucket (Cushman territory).
 */
export function pickVerifyOrDeleteTargets(args: {
  bureau: string;
  tradelines: TLForTargeting[];
  states: BureauStateForTargeting[];
}): Array<{ tradeline: TLForTargeting; status_on_bureau: string }> {
  const bk = bureauKey(args.bureau);
  const tlById = new Map(args.tradelines.map(t => [t.id, t] as const));
  const out: Array<{ tradeline: TLForTargeting; status_on_bureau: string }> = [];
  for (const s of args.states) {
    if (bureauKey(s.bureau) !== bk) continue;
    const status = (s.status_on_bureau || '').toLowerCase().trim();
    if (!status) continue;
    const matches = ['verified', 'updated', 'no change', 'confirmed'].some(t => status.includes(t));
    if (!matches) continue;
    const tl = tlById.get(s.tradeline_id);
    if (tl) out.push({ tradeline: tl, status_on_bureau: s.status_on_bureau as string });
  }
  return out;
}
