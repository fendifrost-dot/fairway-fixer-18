// Operator Console Types

export type EventCategory = 'Action' | 'Response' | 'Outcome' | 'Note';

// Fixed 11-source enum - matches DB and parser exactly
// Matches DB enum exactly (PascalCase)
// DB enum values (PascalCase) - matches DB exactly
export type EventSource = 
  | 'Experian' | 'TransUnion' | 'Equifax' 
  | 'Innovis' | 'LexisNexis' | 'Sagestream' | 'CoreLogic'
  | 'ChexSystems' | 'EWS' | 'NCTUE'
  | 'CFPB' | 'BBB' | 'AG' | 'FTC'
  | 'Creditor'
  | 'Other';

export type SimplePriority = 'Low' | 'Medium' | 'High';
export type SimpleStatus = 'Open' | 'Done';

export interface RelatedAccount {
  name: string;
  masked_number?: string;
  issue?: string;
}

export interface TimelineEvent {
  id: string;
  client_id: string;
  event_date: string | null;
  /**
   * When true, this event should render as "Date unknown" even if event_date is present.
   * (Used for forensic accuracy when dates are unreliable.)
   */
  date_is_unknown?: boolean;
  category: EventCategory;
  source: EventSource | null;
  title: string;
  summary: string;
  details: string | null;
  related_accounts: RelatedAccount[] | null;
  /** Raw source line used for audit/debugging (optional in UI types). */
  raw_line?: string;
  /** action | response | outcome | draft (optional in UI types). */
  event_kind?: string;
  /** When true, this is a draft document (not sent) - excluded from Evidence Timeline. */
  is_draft?: boolean;
  /** Optional dispute round this event belongs to. */
  round_id?: string | null;
  /** Optional furnisher (creditor / collection agency) this event belongs to. */
  furnisher_id?: string | null;
  /** Optional tradeline this event belongs to (B5). */
  tradeline_id?: string | null;
  created_at: string;
}

// ============================================================================
// TIMELINE EVENT ATTACHMENTS (B7)
// ============================================================================

export interface TimelineEventAttachment {
  id: string;
  event_id: string;
  drive_path: string;
  file_url: string | null;
  mime_type: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
}

// ============================================================================
// DISPUTE ROUNDS
// ============================================================================

export type DisputeRoundStatus =
  | 'planning'
  | 'mailed'
  | 'awaiting_response'
  | 'response_received'
  | 'closed';

export interface DisputeRound {
  id: string;
  client_id: string;
  round_number: number;
  submitted_at: string | null;
  completed_at: string | null;
  status: DisputeRoundStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const DISPUTE_ROUND_STATUSES: DisputeRoundStatus[] = [
  'planning',
  'mailed',
  'awaiting_response',
  'response_received',
  'closed',
];

export const DISPUTE_ROUND_STATUS_LABELS: Record<DisputeRoundStatus, string> = {
  planning: 'Planning',
  mailed: 'Mailed',
  awaiting_response: 'Awaiting response',
  response_received: 'Response received',
  closed: 'Closed',
};

// ============================================================================
// FURNISHERS (B4 — first-class category alongside Bureaus / Data Brokers)
// ============================================================================

export interface Furnisher {
  id: string;
  client_id: string;
  name: string;
  account_last4: string | null;
  account_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TRADELINES (B5 — per-tradeline cross-bureau pivot)
// ============================================================================

export type TradelineStatus = 'active' | 'disputed' | 'deleted' | 'verified' | 'unknown';
export const TRADELINE_STATUSES: TradelineStatus[] = ['active', 'disputed', 'deleted', 'verified', 'unknown'];

export type TradelineBureau = 'equifax' | 'experian' | 'transunion';
export const TRADELINE_BUREAUS: TradelineBureau[] = ['equifax', 'experian', 'transunion'];

export interface Tradeline {
  id: string;
  client_id: string;
  furnisher_id: string | null;
  display_name: string;
  account_last4: string | null;
  balance: number | null;
  opened_date: string | null;
  status: TradelineStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradelineBureauState {
  id: string;
  tradeline_id: string;
  bureau: TradelineBureau;
  present: boolean;
  status_on_bureau: string | null;
  last_seen_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperatorTask {
  id: string;
  client_id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  notes: string | null;
  linked_event_ids: string[];
  recurrence_rule: string | null;
  priority: SimplePriority;
  status: SimpleStatus;
  created_at: string;
}

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  priority: SimplePriority;
  source?: EventSource;
}

// ChatGPT Import Parser Types
export interface ParsedImport {
  events: Omit<TimelineEvent, 'id' | 'created_at'>[];
  tasks: Omit<OperatorTask, 'id' | 'created_at'>[];
}

// ============================================================================
// FIXED SOURCE STRUCTURE - 11 sources in 3 categories
// ============================================================================

// Credit Bureaus (core 3)
export const CRA_SOURCES: EventSource[] = ['Experian', 'TransUnion', 'Equifax'];

// Data Brokers (7 sources - matches DB)
export const DATA_BROKER_SOURCES: EventSource[] = ['Innovis', 'LexisNexis', 'Sagestream', 'CoreLogic', 'ChexSystems', 'EWS', 'NCTUE'];

// Regulatory (4 sources in DB)  
export const REGULATORY_SOURCES: EventSource[] = ['CFPB', 'BBB', 'AG', 'FTC'];

// Direct Dispute Targets (creditors, furnishers, collectors, lenders, servicers)
export const DIRECT_SOURCES: EventSource[] = ['Creditor'];

// Fixed accordion structure - ALWAYS rendered
export const SOURCE_ACCORDION_STRUCTURE = [
  {
    group: 'Credit Bureaus',
    sources: CRA_SOURCES,
  },
  {
    group: 'Data Brokers',
    sources: DATA_BROKER_SOURCES,
  },
  {
    group: 'Regulatory',
    sources: REGULATORY_SOURCES,
  },
  {
    group: 'Direct Disputes',
    sources: DIRECT_SOURCES,
  },
] as const;

// All valid evidence sources (excludes 'Other' for placement)
export const ALL_EVIDENCE_SOURCES: EventSource[] = [
  ...CRA_SOURCES,
  ...DATA_BROKER_SOURCES,
  ...REGULATORY_SOURCES,
  ...DIRECT_SOURCES,
];

// All sources including Other
export const ALL_SOURCES: EventSource[] = [...ALL_EVIDENCE_SOURCES, 'Other'];

export const EVENT_CATEGORIES: EventCategory[] = ['Action', 'Response', 'Outcome', 'Note'];
export const PRIORITIES: SimplePriority[] = ['Low', 'Medium', 'High'];

// Source display names for UI
export const SOURCE_DISPLAY_NAMES: Record<EventSource, string> = {
  Experian: 'Experian',
  TransUnion: 'TransUnion',
  Equifax: 'Equifax',
  Innovis: 'Innovis',
  LexisNexis: 'LexisNexis',
  Sagestream: 'SageStream',
  CoreLogic: 'CoreLogic',
  ChexSystems: 'ChexSystems',
  EWS: 'EWS',
  NCTUE: 'NCTUE',
  CFPB: 'CFPB',
  BBB: 'BBB',
  AG: 'Attorney General',
  FTC: 'FTC',
  Creditor: 'Creditor / Furnisher',
  Other: 'Other',
};

// ============================================================================
// SOURCE CORRECTION AUDIT TYPES
// ============================================================================

export interface SourceCorrection {
  id: string;
  event_id: string;
  from_source: EventSource;
  to_source: EventSource;
  corrected_by: string;
  corrected_at: string;
  notes: string | null;
}

// ============================================================================
// DIAGNOSTIC SIGNALS (C-series)
// ============================================================================

export type DiagnosticSignalType = 'furnisher_rename' | 'post_round_new_harm';
export type DiagnosticSignalSeverity = 'info' | 'warning' | 'critical';

export interface FurnisherRenameSubjectIds {
  bureau: TradelineBureau;
  tradeline_old: string;
  tradeline_new: string;
}

export interface FurnisherRenameEvidence {
  matched_account_last4: string | null;
  opened_date_delta_days: number | null;
  balance_delta_pct: number | null;
  old_display_name: string;
  new_display_name: string;
}

// C2 — Post-round new harm
export interface PostRoundNewHarmSubjectIds {
  round_id: string;
  tradeline_id: string;
}

export interface PostRoundNewHarmEvidence {
  opened_date: string | null;
  first_seen_at: string;            // tradeline.created_at (ISO)
  round_submitted_at: string;       // round.submitted_at (ISO date)
  days_after_round_submission: number;
  display_name: string;
  round_number: number;
}

export interface DiagnosticSignal {
  id: string;
  client_id: string;
  signal_type: DiagnosticSignalType;
  subject_ids:
    | FurnisherRenameSubjectIds
    | PostRoundNewHarmSubjectIds
    | Record<string, unknown>;
  evidence:
    | FurnisherRenameEvidence
    | PostRoundNewHarmEvidence
    | Record<string, unknown>;
  severity: DiagnosticSignalSeverity;
  detected_at: string;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}
