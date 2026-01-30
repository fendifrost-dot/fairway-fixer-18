// Operator Console Types

export type EventCategory = 'Action' | 'Response' | 'Outcome' | 'Note';

export type EventSource = 
  | 'Experian' | 'TransUnion' | 'Equifax' 
  | 'LexisNexis' | 'CoreLogic' | 'Innovis' | 'Sagestream'
  | 'ChexSystems' | 'EWS' | 'NCTUE'
  | 'CFPB' | 'BBB' | 'AG' | 'Other';

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
  event_date: string;
  category: EventCategory;
  source: EventSource | null;
  title: string;
  summary: string;
  details: string | null;
  related_accounts: RelatedAccount[] | null;
  created_at: string;
}

export interface OperatorTask {
  id: string;
  client_id: string;
  title: string;
  due_date: string | null;
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

// Source categories for grouping
export const CRA_SOURCES: EventSource[] = ['Experian', 'TransUnion', 'Equifax'];
export const DATA_BROKER_SOURCES: EventSource[] = ['LexisNexis', 'CoreLogic', 'Innovis', 'Sagestream', 'ChexSystems', 'EWS', 'NCTUE'];
export const REGULATORY_SOURCES: EventSource[] = ['CFPB', 'BBB', 'AG'];

export const ALL_SOURCES: EventSource[] = [
  ...CRA_SOURCES,
  ...DATA_BROKER_SOURCES,
  ...REGULATORY_SOURCES,
  'Other'
];

export const EVENT_CATEGORIES: EventCategory[] = ['Action', 'Response', 'Outcome', 'Note'];
export const PRIORITIES: SimplePriority[] = ['Low', 'Medium', 'High'];
