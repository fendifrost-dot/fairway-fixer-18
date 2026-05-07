/**
 * C5 — Dispute letter generation types.
 *
 * Shared between the client UI, pure routing/template logic, and the
 * generate-dispute-letter edge function payload.
 */

export type DisputeLetterType =
  | 'round_n_initial'
  | 'verify_or_delete'
  | 'overdue_violation'
  | 'data_broker_followup'
  | 'furnisher_direct';

export const DISPUTE_LETTER_TYPE_LABELS: Record<DisputeLetterType, string> = {
  round_n_initial: 'Initial dispute',
  verify_or_delete: 'Verify or delete (MOV)',
  overdue_violation: 'Overdue / §1681i violation',
  data_broker_followup: 'Data-broker follow-up',
  furnisher_direct: '§1681s-2(b) furnisher direct',
};

export interface GenerateDisputeLetterRequest {
  client_id: string;
  round_number: number;
  letter_type: DisputeLetterType;
  /** Required for all letter_types except furnisher_direct. */
  bureau?: string | null;
  /** Required for letter_type='furnisher_direct'. */
  furnisher_id?: string | null;
  /** When the call originates from a diagnostic signal CTA, pass the id here. */
  signal_id?: string | null;
}

export interface GenerateDisputeLetterResponse {
  letter_url: string;          // signed URL, ~1h expiry
  storage_path: string;
  event_id: string;
  attachment_id: string;
  summary: string;             // e.g. "3 items disputed"
  item_count: number;
}

/** Bureau-status tokens we treat as "verified / updated" — Cushman territory. */
export const VERIFIED_STATUS_TOKENS = ['verified', 'updated', 'no change', 'confirmed'];

export interface RoundContext {
  id: string;
  round_number: number;
  status: string;
  submitted_at: string | null;
  completed_at: string | null;
}

export interface SignalContext {
  id: string;
  signal_type: string;
  subject_ids: Record<string, unknown>;
  evidence: Record<string, unknown>;
  dismissed_at: string | null;
}
