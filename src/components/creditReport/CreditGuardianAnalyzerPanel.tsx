import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Shield, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  analyzeCreditReport,
  backfillCreditReports,
  formatCreditReportLabel,
  useCreditReportAnalysis,
  useCreditReports,
} from '@/hooks/useCreditReports';
import type { AnalysisViolation, LetterSuggestion } from '@/integrations/supabase/creditGuardianTables';

interface CreditGuardianAnalyzerPanelProps {
  clientId: string;
}

function severityVariant(severity?: string): 'destructive' | 'secondary' | 'outline' {
  if (severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

export function CreditGuardianAnalyzerPanel({ clientId }: CreditGuardianAnalyzerPanelProps) {
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [liveViolations, setLiveViolations] = useState<AnalysisViolation[] | null>(null);
  const [liveBaseline, setLiveBaseline] = useState<string | null>(null);
  const [liveLetters, setLiveLetters] = useState<LetterSuggestion[] | null>(null);

  const { data: reports = [], isLoading, refetch } = useCreditReports(clientId);
  const { data: persistedAnalysis, isLoading: analysisLoading } = useCreditReportAnalysis(selectedReportId);

  useEffect(() => {
    if (selectedReportId) return;
    if (reports.length > 0) {
      setSelectedReportId(reports[0].id);
    }
  }, [reports, selectedReportId]);

  useEffect(() => {
    if (isLoading || reports.length > 0 || backfilling) return;
    let cancelled = false;
    (async () => {
      setBackfilling(true);
      try {
        const result = await backfillCreditReports(clientId);
        if (!cancelled && result.created_count > 0) {
          await refetch();
        }
      } catch {
        // No orphan tradelines — keep empty state.
      } finally {
        if (!cancelled) setBackfilling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, isLoading, reports.length, backfilling, refetch]);

  useEffect(() => {
    if (persistedAnalysis) {
      setLiveViolations(persistedAnalysis.violations ?? []);
      setLiveBaseline(persistedAnalysis.baseline_summary);
      setLiveLetters(persistedAnalysis.letter_suggestions ?? []);
    } else if (!analysisLoading) {
      setLiveViolations(null);
      setLiveBaseline(null);
      setLiveLetters(null);
    }
  }, [persistedAnalysis, analysisLoading]);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const result = await backfillCreditReports(clientId);
      await refetch();
      toast.success(
        result.created_count > 0
          ? `Backfilled ${result.created_count} credit report(s) from existing tradelines`
          : 'No orphan tradelines to backfill',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedReportId) return;
    setAnalyzing(true);
    try {
      const result = await analyzeCreditReport(clientId, selectedReportId);
      setLiveViolations(result.violations ?? []);
      setLiveBaseline(result.baseline_summary ?? null);
      setLiveLetters(result.letter_suggestions ?? []);
      queryClient.invalidateQueries({ queryKey: ['credit-report-analysis', selectedReportId] });
      toast.success('Analysis complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const violations = liveViolations ?? [];
  const baseline = liveBaseline;
  const letterSuggestions = liveLetters ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Credit Guardian Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Credit Guardian Analyzer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reports.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
            <p>
              No credit reports uploaded yet. Import reports via ChatGPT Import, paste structured
              text, or upload a PDF — then commit from the Upload report dialog.
            </p>
            <Button size="sm" variant="outline" disabled={backfilling} onClick={handleBackfill}>
              {backfilling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Reconstruct from existing tradelines
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Select value={selectedReportId ?? undefined} onValueChange={setSelectedReportId}>
                <SelectTrigger className="sm:flex-1">
                  <SelectValue placeholder="Select a credit report…" />
                </SelectTrigger>
                <SelectContent>
                  {reports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {formatCreditReportLabel(r)}
                      {r.parse_summary?.backfill ? ' (backfill)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!selectedReportId || analyzing} onClick={handleAnalyze}>
                {analyzing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Analyze
              </Button>
            </div>

            <Tabs defaultValue="violations" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="violations">
                  Violations
                  {violations.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                      {violations.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="letters">Letters</TabsTrigger>
              </TabsList>

              <TabsContent value="reports" className="mt-3 text-sm space-y-2">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="flex justify-between items-center border rounded p-2 cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedReportId(r.id)}
                  >
                    <span>{formatCreditReportLabel(r)}</span>
                    <Badge variant="outline">{r.source_type}</Badge>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="violations" className="mt-3 text-sm space-y-2">
                {violations.length === 0 ? (
                  <p className="text-muted-foreground">
                    {persistedAnalysis || analysisLoading
                      ? 'No violations flagged for this report.'
                      : 'Select a report and run Analyze to detect violations.'}
                  </p>
                ) : (
                  violations.map((v, i) => (
                    <div key={`${v.type}-${i}`} className="border rounded p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={severityVariant(v.severity)}>{v.type.replace(/_/g, ' ')}</Badge>
                        {v.severity && <span className="text-xs text-muted-foreground">{v.severity}</span>}
                      </div>
                      <p className="text-sm">{v.narrative}</p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="letters" className="mt-3 text-sm space-y-2">
                {letterSuggestions.length === 0 ? (
                  <p className="text-muted-foreground">
                    Run Analyze to see letter suggestions grounded in detected violations.
                  </p>
                ) : (
                  letterSuggestions.map((s) => (
                    <div key={s.label} className="border rounded p-3">
                      <p className="font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.letter_type} → {s.recipient_name}</p>
                      <p className="text-sm mt-2">{s.rationale}</p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>

            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Baseline Analysis
              </p>
              {baseline ? (
                <pre className="text-sm whitespace-pre-wrap font-sans">{baseline}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">No baseline analysis yet.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
