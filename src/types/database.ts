// Database types that match our Supabase schema
// These are used for frontend type safety

export type MatterState = 
  | 'Intake'
  | 'DisputePreparation'
  | 'DisputeActive'
  | 'PartialCompliance'
  | 'ViolationConfirmed'
  | 'ReinsertionDetected'
  | 'RegulatoryReview'
  | 'Blocked'
  | 'FurnisherLiabilityTrack'
  | 'EscalationEligible'
  | 'LitigationReady'
  | 'Resolved';

export type MatterType = 'Credit' | 'Consulting' | 'Both';
export type EntityType = 'CRA' | 'Furnisher' | 'DataBroker' | 'Agency';
export type OverlayType = 'IdentityTheftDocumented' | 'MixedFileConfirmed' | 'UpstreamContainmentActive';
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type TaskStatus = 'Pending' | 'InProgress' | 'Done' | 'Blocked';
export type DeadlineStatus = 'Open' | 'DueSoon' | 'Overdue' | 'Closed';
export type DeadlineType = '611_30day' | '611_notice' | '605B_4biz' | 'Reinsertion_5biz' | 'CFPB_15' | 'CFPB_60' | 'FollowUp';
export type ResponseType = 'NoResponse' | 'Boilerplate' | 'Verified' | 'Deleted' | 'PartialDeleted' | 'Reinserted' | 'MOVProvided' | 'AuthBlocked' | 'Other';
export type DateConfidence = 'Exact' | 'Inferred' | 'Unknown';
export type EvidenceType = 'Report' | 'Portal' | 'Mail' | 'ClientStatement' | 'Unknown';
export type ViolationTrigger = 'Missed611Deadline' | 'Reinsertion611a5B' | 'Failure605B' | 'NoMOV' | 'Boilerplate';
export type ClientStatus = 'Active' | 'Inactive' | 'Pending';

export interface DbClient {
  id: string;
  legal_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMatter {
  id: string;
  client_id: string;
  matter_type: MatterType;
  title: string;
  jurisdiction: string | null;
  primary_state: MatterState;
  escalation_strategy: string | null;
  overall_reliability_rating: number | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: DbClient;
}

export interface DbEntityCase {
  id: string;
  matter_id: string;
  entity_type: EntityType;
  entity_name: string;
  state: MatterState;
  last_action_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTask {
  id: string;
  matter_id: string;
  entity_case_id: string | null;
  related_account_id: string | null;
  task_type: string;
  priority: TaskPriority;
  due_date: string | null;
  status: TaskStatus;
  auto_generated: boolean;
  completion_notes: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  // Joined fields
  matter?: DbMatter;
  entity_case?: DbEntityCase;
}

export interface DbDeadline {
  id: string;
  matter_id: string;
  entity_case_id: string;
  deadline_type: DeadlineType;
  start_date: string;
  due_date: string;
  status: DeadlineStatus;
  source_action_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  matter?: DbMatter;
  entity_case?: DbEntityCase;
}

export interface DbViolation {
  id: string;
  matter_id: string;
  entity_case_id: string;
  trigger: ViolationTrigger;
  statutory_section: string;
  severity: number;
  evidence_attached: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  matter?: DbMatter;
  entity_case?: DbEntityCase;
}

export interface DbOverlay {
  id: string;
  matter_id: string;
  overlay_type: OverlayType;
  is_active: boolean;
  activated_at: string;
  deactivated_at: string | null;
  created_at: string;
}

export interface DbAction {
  id: string;
  matter_id: string;
  entity_case_id: string | null;
  action_type: string;
  action_date: string;
  delivered_date: string | null;
  date_confidence: DateConfidence;
  evidence_type: EvidenceType;
  summary: string | null;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DbResponse {
  id: string;
  matter_id: string;
  entity_case_id: string;
  received_date: string;
  response_type: ResponseType;
  summary: string | null;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DbSavedView {
  id: string;
  user_id: string;
  name: string;
  filters: DashboardFilters;
  is_default: boolean;
  created_at: string;
}

// Dashboard filter state
export interface DashboardFilters {
  scope: 'all' | 'single' | 'assigned';
  clientId?: string;
  matterType: MatterType | 'all';
  states: MatterState[];
  timeWindow: 'today' | 'week' | 'month' | 'overdue';
}

// Labels
export const STATE_LABELS: Record<MatterState, { label: string; description: string; color: string }> = {
  Intake: { label: 'Intake', description: 'Client onboarded, collecting documents', color: 'state-intake' },
  DisputePreparation: { label: 'Dispute Prep', description: 'Drafting disputes and evidence', color: 'state-intake' },
  DisputeActive: { label: 'Dispute Active', description: 'Monitoring statutory deadlines', color: 'state-active' },
  PartialCompliance: { label: 'Partial Compliance', description: 'Some items deleted, others remain', color: 'state-partial' },
  ViolationConfirmed: { label: 'Violation Confirmed', description: 'CRA noncompliance established', color: 'state-violation' },
  ReinsertionDetected: { label: 'Reinsertion', description: 'Previously deleted item reappeared', color: 'state-reinsertion' },
  RegulatoryReview: { label: 'Regulatory Review', description: 'CFPB complaint filed', color: 'state-regulatory' },
  Blocked: { label: 'Blocked', description: 'Process stalled - authorization needed', color: 'state-blocked' },
  FurnisherLiabilityTrack: { label: 'Furnisher Track', description: 'Section 623(b) duties active', color: 'state-furnisher' },
  EscalationEligible: { label: 'Escalation Eligible', description: 'BBB, AG, litigation pathways open', color: 'state-escalation' },
  LitigationReady: { label: 'Litigation Ready', description: 'Willfulness threshold met', color: 'state-litigation' },
  Resolved: { label: 'Resolved', description: 'All items removed, monitoring', color: 'state-resolved' },
};

export const DEADLINE_LABELS: Record<DeadlineType, { label: string; statute: string; description: string }> = {
  '611_30day': { label: '§611 30-Day', statute: '§611(a)(1)', description: 'CRA must complete reinvestigation within 30 days' },
  '611_notice': { label: '§611 Notice', statute: '§611(a)(6)', description: 'CRA must provide written notice within 5 business days of completion' },
  '605B_4biz': { label: '§605B Blocking', statute: '§605B', description: 'CRA must block identity theft information within 4 business days' },
  'Reinsertion_5biz': { label: 'Reinsertion Notice', statute: '§611(a)(5)(B)', description: 'CRA may only reinsert with certification and 5-day notice' },
  'CFPB_15': { label: 'CFPB 15-Day', statute: 'CFPB Rule', description: 'Company must respond to CFPB complaint within 15 days' },
  'CFPB_60': { label: 'CFPB 60-Day', statute: 'CFPB Rule', description: 'Company must resolve CFPB complaint within 60 days' },
  'FollowUp': { label: 'Follow-Up', statute: 'Operational', description: 'Internal follow-up action required' },
};

export const PRIORITY_LABELS: Record<TaskPriority, { label: string; description: string }> = {
  P0: { label: 'Statutory', description: 'Legal deadlines - immediate action required' },
  P1: { label: 'Regulatory', description: 'CFPB/BBB/AG windows' },
  P2: { label: 'Operational', description: 'Mail proofs, client updates' },
  P3: { label: 'Maintenance', description: 'Ongoing monitoring' },
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  CRA: 'Credit Reporting Agency',
  Furnisher: 'Furnisher',
  DataBroker: 'Data Broker',
  Agency: 'Regulatory Agency',
};

export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  NoResponse: 'No Response',
  Boilerplate: 'Boilerplate / Still Working',
  Verified: 'Verified',
  Deleted: 'Deleted',
  PartialDeleted: 'Partial Deleted',
  Reinserted: 'Reinserted',
  MOVProvided: 'MOV Provided',
  AuthBlocked: 'Authorization / Portal Blocked',
  Other: 'Other',
};

// Checklist task types
export const CHECKLIST_TASK_TYPES = [
  'Check Credit Report (CRA)',
  'Check CFPB Portal',
  'Check Mail / Delivery / Proof',
  'Check Data Broker Freeze Status',
  'Check Furnisher Response',
  'Classify Response',
] as const;

export type ChecklistTaskType = typeof CHECKLIST_TASK_TYPES[number];

// Standard action types for logging
export const ACTION_TYPES = [
  'Dispute Sent',
  'Follow-Up Sent',
  'CFPB Complaint Filed',
  'BBB Complaint Filed',
  'AG Complaint Filed',
  'Demand Letter Sent',
  'Data Broker Freeze Submitted',
  'FTC Report Filed',
  'Police Report Filed',
  'Document Requested',
  'Document Received',
  'Report Pulled',
  'Portal Check',
  'Other',
] as const;

export type ActionType = typeof ACTION_TYPES[number];

// Default entity cases for new credit matters
export const DEFAULT_CRA_ENTITIES = [
  { entity_type: 'CRA' as EntityType, entity_name: 'Experian' },
  { entity_type: 'CRA' as EntityType, entity_name: 'TransUnion' },
  { entity_type: 'CRA' as EntityType, entity_name: 'Equifax' },
];

export const OPTIONAL_ENTITIES = [
  { entity_type: 'CRA' as EntityType, entity_name: 'Innovis' },
  { entity_type: 'DataBroker' as EntityType, entity_name: 'LexisNexis' },
  { entity_type: 'DataBroker' as EntityType, entity_name: 'CoreLogic Teletrack' },
  { entity_type: 'DataBroker' as EntityType, entity_name: 'SageStream' },
];

// Saved view presets
export const PRESET_VIEWS: { name: string; filters: Partial<DashboardFilters> }[] = [
  { name: 'P0 Today', filters: { timeWindow: 'today' } },
  { name: 'Due in 5 Days', filters: { timeWindow: 'week' } },
  { name: 'Reinsertion', filters: { states: ['ReinsertionDetected'] } },
  { name: 'CFPB Waiting', filters: { states: ['RegulatoryReview'] } },
  { name: 'Needs Report Check', filters: { states: ['DisputeActive', 'PartialCompliance'] } },
];
