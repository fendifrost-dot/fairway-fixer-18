/**
 * Typed-ish access to Credit Guardian tables from migration 20260605174500.
 * Regenerate src/integrations/supabase/types.ts after applying migrations to prod.
 */
import { supabase } from './client';

export type CreditBureau = 'equifax' | 'experian' | 'transunion';

export interface CreditReportRow {
  id: string;
  client_id: string;
  bureau: CreditBureau;
  report_date: string;
  import_scope: string;
  source_type: string;
  source_storage_path: string | null;
  raw_text: string | null;
  parse_summary: Record<string, unknown>;
  created_at: string;
}

export interface CreditReportAnalysisRow {
  id: string;
  credit_report_id: string;
  client_id: string;
  violations: AnalysisViolation[];
  baseline_summary: string | null;
  letter_suggestions: LetterSuggestion[];
  analyzed_at: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisViolation {
  type: string;
  narrative: string;
  severity?: string;
  tradeline_id?: string;
}

export interface LetterSuggestion {
  label: string;
  letter_type: string;
  recipient_type: 'cra' | 'furnisher' | 'collector' | 'regulator';
  recipient_name: string;
  rationale: string;
}

type UntypedDb = {
  from(table: string): ReturnType<typeof supabase.from>;
};

const db = supabase as unknown as UntypedDb;

export function creditReportsTable() {
  return db.from('credit_reports');
}

export function creditReportAnalysesTable() {
  return db.from('credit_report_analyses');
}

export function tradelinesTable() {
  return db.from('tradelines');
}
