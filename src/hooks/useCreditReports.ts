import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunctionWithBody } from '@/lib/invokeEdgeFunction';
import type { AnalysisViolation, LetterSuggestion } from '@/integrations/supabase/creditGuardianTables';
import {
  creditReportAnalysesTable,
  creditReportsTable,
  type CreditReportAnalysisRow,
  type CreditReportRow,
} from '@/integrations/supabase/creditGuardianTables';

function formatBureauLabel(bureau: string) {
  return bureau.charAt(0).toUpperCase() + bureau.slice(1);
}

export function formatCreditReportLabel(report: Pick<CreditReportRow, 'bureau' | 'report_date'>) {
  return `${formatBureauLabel(report.bureau)} — ${report.report_date}`;
}

export function useCreditReports(clientId: string) {
  return useQuery({
    queryKey: ['credit-reports', clientId],
    queryFn: async () => {
      const { data, error } = await creditReportsTable()
        .select('id, client_id, bureau, report_date, import_scope, source_type, parse_summary, created_at')
        .eq('client_id', clientId)
        .order('report_date', { ascending: false });

      if (error) throw error;
      return (data ?? []) as CreditReportRow[];
    },
    enabled: !!clientId,
  });
}

export function useCreditReportAnalysis(creditReportId: string | null) {
  return useQuery({
    queryKey: ['credit-report-analysis', creditReportId],
    queryFn: async () => {
      if (!creditReportId) return null;
      const { data, error } = await creditReportAnalysesTable()
        .select('*')
        .eq('credit_report_id', creditReportId)
        .maybeSingle();

      if (error) throw error;
      return data as CreditReportAnalysisRow | null;
    },
    enabled: !!creditReportId,
  });
}

export async function backfillCreditReports(clientId: string) {
  return invokeEdgeFunctionWithBody<{ created_count: number }>('backfill-credit-reports', {
    client_id: clientId,
  });
}

export async function analyzeCreditReport(clientId: string, creditReportId: string) {
  return invokeEdgeFunctionWithBody<{
    violations?: AnalysisViolation[];
    baseline_summary?: string | null;
    letter_suggestions?: LetterSuggestion[];
    analysis_id?: string;
  }>('analyze-credit-report', {
    client_id: clientId,
    credit_report_id: creditReportId,
  });
}
