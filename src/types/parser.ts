/**
 * Deterministic Parser Entity Types
 * 
 * Contract: These types define the strict schema for all parsed entities.
 * No silent defaults. No keyword inference. Section-header-based routing only.
 */

// ============================================================================
// SOURCE NORMALIZATION
// ============================================================================

export const SOURCE_ENUM = [
  'experian',
  'transunion', 
  'equifax',
  'innovis',
  'lexisnexis',
  'sagestream',
  'corelogic',
  'ftc',
  'cfpb',
  'bbb',
  'ag',
] as const;

export type NormalizedSource = typeof SOURCE_ENUM[number];

export const CRA_SOURCES: NormalizedSource[] = ['experian', 'transunion', 'equifax'];

// Source normalization mapping (input variants => normalized)
export const SOURCE_NORMALIZATION_MAP: Record<string, NormalizedSource> = {
  // Credit Bureaus
  'experian': 'experian',
  'exp': 'experian',
  'transunion': 'transunion',
  'trans union': 'transunion',
  'tu': 'transunion',
  'equifax': 'equifax',
  'efx': 'equifax',
  'eq': 'equifax',
  'innovis': 'innovis',
  
  // Data Brokers
  'lexisnexis': 'lexisnexis',
  'lexis nexis': 'lexisnexis',
  'lexis': 'lexisnexis',
  'ln': 'lexisnexis',
  'sagestream': 'sagestream',
  'sage stream': 'sagestream',
  'corelogic': 'corelogic',
  'core logic': 'corelogic',
  'teletrack': 'corelogic',
  'corelogic teletrack': 'corelogic',
  
  // Regulatory
  'ftc': 'ftc',
  'federal trade commission': 'ftc',
  'cfpb': 'cfpb',
  'consumer financial protection bureau': 'cfpb',
  'bbb': 'bbb',
  'better business bureau': 'bbb',
  'ag': 'ag',
  'attorney general': 'ag',
  'state ag': 'ag',
};

// ============================================================================
// CLIENT PROFILE (from "CLIENT PROFILE" section)
// ============================================================================

export const PRIMARY_ISSUE_TYPES = [
  'identity_theft',
  'mixed_file',
  'unauthorized_inquiries',
  'general_credit_repair',
] as const;

export type PrimaryIssueType = typeof PRIMARY_ISSUE_TYPES[number];

export interface ClientProfile {
  full_legal_name: string; // required
  dob: string | null; // optional YYYY-MM-DD
  ssn_last4: string | null; // optional ####
  primary_issue_type: PrimaryIssueType; // required
  profile_notes: string[]; // optional
}

// ============================================================================
// TIMELINE EVENT (from COMPLETED ACTIONS / RESPONSES RECEIVED / OUTCOMES OBSERVED)
// ============================================================================

export const EVENT_KINDS = ['action', 'response', 'outcome'] as const;
export type EventKind = typeof EVENT_KINDS[number];

export const SCOPE_VALUES = ['single', 'all_cras'] as const;
export type ScopeValue = typeof SCOPE_VALUES[number];

export interface TimelineEventParsed {
  event_kind: EventKind; // required
  event_date: string | null; // YYYY-MM-DD or null if unknown
  date_is_unknown: boolean; // true if date had XX or was unparseable
  source: NormalizedSource; // required - if missing, NOT a timeline event
  scope: ScopeValue; // single or all_cras
  action_type: string | null; // optional
  status_verb: string | null; // optional
  counterparty: string | null; // optional
  account_ref: string | null; // optional
  description: string; // required
  raw_line: string; // required - original input line
}

// ============================================================================
// UNRESOLVED ITEM (from "OPEN / UNRESOLVED ITEMS" - STATE, NOT TIMELINE)
// ============================================================================

export const UNRESOLVED_ITEM_TYPES = [
  'account',
  'inquiry',
  'personal_identifier',
  'address',
  'employment',
  'other',
] as const;

export type UnresolvedItemType = typeof UNRESOLVED_ITEM_TYPES[number];

export interface UnresolvedItem {
  source_scope: ScopeValue; // required
  source: NormalizedSource | null; // nullable if all_cras
  item_type: UnresolvedItemType; // required
  counterparty: string | null; // optional
  account_ref: string | null; // optional
  status: string; // required
  last_noted_date: string | null; // optional nullable YYYY-MM-DD
  date_is_unknown: boolean;
  description: string; // required
  raw_line: string; // required
}

// ============================================================================
// SCHEDULED EVENT (from "SUGGESTED NEXT ACTIONS" / "TODO")
// ============================================================================

export interface ScheduledEvent {
  due_date: string | null; // nullable if ASAP or unparseable
  due_text: string | null; // original text like "ASAP" if date is null
  source: NormalizedSource | null;
  description: string; // required
  priority: 'low' | 'medium' | 'high';
  raw_line: string;
}

// ============================================================================
// DRAFT ITEM (from "DOCUMENTS DRAFTED (NOT SENT)")
// ============================================================================

export interface DraftItem {
  created_date: string | null;
  document_type: string;
  target_entity: NormalizedSource | null;
  description: string;
  raw_line: string;
}

// ============================================================================
// NOTES / FLAGS (from "MISSING INFORMATION FLAGS" + unrouted warnings)
// ============================================================================

export interface NoteFlag {
  flag_date: string | null;
  flag_type: 'missing_info' | 'unrouted_warning' | 'parse_error' | 'general';
  description: string;
  raw_line: string;
}

// ============================================================================
// PARSE RESULT
// ============================================================================

export interface ParseCounts {
  actions: number;
  responses: number;
  outcomes: number;
  unresolved: number;
  scheduled: number;
  drafts: number;
  notes: number;
  unrouted: number;
}

export interface ParseResult {
  client_profile: ClientProfile | null;
  timeline_events: TimelineEventParsed[];
  unresolved_items: UnresolvedItem[];
  scheduled_events: ScheduledEvent[];
  draft_items: DraftItem[];
  notes_flags: NoteFlag[];
  unrouted_lines: string[];
  errors: string[];
  counts: ParseCounts;
}

// ============================================================================
// SECTION TYPES
// ============================================================================

export type SectionType = 
  | 'none'
  | 'client_profile'
  | 'completed_actions'
  | 'responses_received'
  | 'outcomes_observed'
  | 'open_unresolved'
  | 'suggested_next'
  | 'drafts'
  | 'missing_info';
