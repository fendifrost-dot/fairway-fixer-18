/**
 * C6 — Upload credit report dialog (Phase 1: paste structured text).
 *
 * Two-step flow:
 *   1. Operator pastes structured-text blob, picks report_date, clicks Parse.
 *   2. Side-by-side diff view; per-row accept/reject + Confirm all.
 */

import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseReportText } from '@/lib/reportIngest/parser';
import { diffReportAgainstState } from '@/lib/reportIngest/diff';
import { commitReportDiff, type CommitRowDecision } from '@/lib/reportIngest/ingest';
import type { ParsedReport, ReportDiffSummary } from '@/lib/reportIngest/types';
import { useTradelines, useTradelineBureauStates } from '@/hooks/useTradelines';

const PLACEHOLDER = `## Bureau: TriMerge
## ScoreEquifax: 598
## ScoreExperian: 612
## ScoreTransUnion: 605
- DISCOVER BANK ****1234 | Charge-off | balance: 439 | opened: 2019-08-01
- SYNERGETIC ****0001 | Collection | balance: 49730
`;

interface Props {
  clientId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function UploadReportDialog({ clientId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: tradelines = [] } = useTradelines(clientId);
  const { data: bureauStates = [] } = useTradelineBureauStates(clientId);

  const [text, setText] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [parsed, setParsed] = useState<ParsedReport | null>(null);
  const [diff, setDiff] = useState<ReportDiffSummary | null>(null);
  const [decisions, setDecisions] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText(''); setParsed(null); setDiff(null); setDecisions({});
  };

  const handleParse = () => {
    try {
      const p = parseReportText(text);
      const d = diffReportAgainstState(p, tradelines, bureauStates, reportDate);
      setParsed(p); setDiff(d);
      // Default: accept everything that's a real change.
      const init: Record<number, boolean> = {};
      d.rows.forEach((r, i) => { init[i] = r.kind !== 'unchanged'; });
      setDecisions(init);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const acceptedCount = useMemo(
    () => Object.values(decisions).filter(Boolean).length,
    [decisions]
  );

  const handleCommit = async () => {
    if (!diff || !parsed) return;
    setBusy(true);
    try {
      const list: CommitRowDecision[] = diff.rows.map((row, i) => ({
        row,
        accept: !!decisions[i],
      }));
      const res = await commitReportDiff(clientId, list, parsed.scores, reportDate);
      toast.success(
        `Committed: +${res.tradelines_added} added, ${res.tradelines_updated} updated, ` +
        `${res.tradelines_disappeared} disappeared` +
        (res.scores_updated ? ', scores updated' : '')
      );
      qc.invalidateQueries({ queryKey: ['tradelines', clientId] });
      qc.invalidateQueries({ queryKey: ['tradeline-bureau-states', clientId] });
      qc.invalidateQueries({ queryKey: ['diagnostic-signals', clientId] });
      qc.invalidateQueries({ queryKey: ['client', clientId] });
      qc.invalidateQueries({ queryKey: ['score-history', clientId] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error('Commit failed: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload credit report</DialogTitle>
        </DialogHeader>

        {!diff ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Report date</Label>
                <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
              </div>
              <div className="text-xs text-muted-foreground self-end pb-1">
                Phase 1: paste structured-text. PDF/vision OCR ships in Phase 2.
              </div>
            </div>
            <div>
              <Label className="text-xs">Structured report text</Label>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                className="font-mono text-xs min-h-[260px]"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Start with <code>## Bureau: Experian</code> (or Equifax / TransUnion / TriMerge).
                Optional <code>## Score:</code> headers. One <code>- ROW</code> per tradeline,
                pipe-separated <code>field: value</code>.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleParse} disabled={!text.trim()}>Parse &amp; preview diff</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">+{diff.tradelines_added} added</Badge>
              <Badge variant="secondary">{diff.tradelines_updated} updated</Badge>
              <Badge variant="secondary">{diff.tradelines_disappeared} disappeared</Badge>
              <Badge variant="outline">{diff.tradelines_unchanged} unchanged</Badge>
              <Badge variant="outline">
                bureaus: {parsed?.bureaus.join(', ') || '—'}
              </Badge>
            </div>
            <ScrollArea className="h-[420px] border rounded-md">
              <div className="divide-y">
                {diff.rows.map((r, i) => (
                  <div
                    key={i}
                    className={`p-2.5 text-xs grid grid-cols-[110px_1fr_auto] gap-3 items-start ${
                      r.kind === 'added' ? 'bg-emerald-50/40' :
                      r.kind === 'disappeared' ? 'bg-red-50/40' :
                      r.kind === 'updated' ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-[10px] capitalize">{r.kind}</Badge>
                      <div className="text-[10px] text-muted-foreground capitalize">{r.bureau}</div>
                      {r.operator_disputed && (
                        <div className="text-[10px] text-amber-700">prev. disputed</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {r.display_name}
                        {r.account_last4 && (
                          <span className="ml-2 text-muted-foreground font-mono">…{r.account_last4}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                        <div>
                          <div className="text-muted-foreground">Before</div>
                          {r.before ? (
                            <div>
                              <div>{r.before.present ? 'present' : 'absent'}</div>
                              <div className="text-muted-foreground truncate">{r.before.status_on_bureau || '—'}</div>
                            </div>
                          ) : <div className="text-muted-foreground italic">(none)</div>}
                        </div>
                        <div>
                          <div className="text-muted-foreground">After</div>
                          {r.after ? (
                            <div>
                              <div>{r.after.present ? 'present' : 'absent'}</div>
                              <div className="text-muted-foreground truncate">{r.after.status_on_bureau || '—'}</div>
                            </div>
                          ) : <div className="text-muted-foreground italic">(none)</div>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant={decisions[i] ? 'default' : 'outline'}
                        className="h-7 text-[11px]"
                        onClick={() => setDecisions(d => ({ ...d, [i]: true }))}
                        disabled={r.kind === 'unchanged'}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant={!decisions[i] ? 'destructive' : 'outline'}
                        className="h-7 text-[11px]"
                        onClick={() => setDecisions(d => ({ ...d, [i]: false }))}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => { setDiff(null); setParsed(null); }}>
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const all: Record<number, boolean> = {};
                  diff.rows.forEach((r, i) => { all[i] = r.kind !== 'unchanged'; });
                  setDecisions(all);
                }}
              >
                Accept all changes
              </Button>
              <Button onClick={handleCommit} disabled={busy || acceptedCount === 0}>
                {busy ? 'Committing…' : `Commit (${acceptedCount})`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}