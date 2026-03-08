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
  created_at: string;
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
