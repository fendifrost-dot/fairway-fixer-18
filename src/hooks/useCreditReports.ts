import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const { data, error } = await supabase.functions.invoke('backfill-credit-reports', {
    body: { client_id: clientId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { created_count: number };
}

export async function analyzeCreditReport(clientId: string, creditReportId: string) {
  const { data, error } = await supabase.functions.invoke('analyze-credit-report', {
    body: { client_id: clientId, credit_report_id: creditReportId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
