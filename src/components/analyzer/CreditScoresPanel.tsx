import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  CreditScoresMap,
  ScoreBureau,
  bureauDisplayName,
  mergeCreditScores,
} from '@/lib/scoreExtraction';
import { interpretScoreTrend } from '@/lib/diagnostics/scoreTrendInterpretation';
import { ScoreTrendWhy } from '@/components/analyzer/ScoreTrendWhy';
import type { ScoreTrendInterpretation } from '@/types/operator';

function scoreColor(score: number | null | undefined): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 700) return 'text-emerald-500';
  if (score >= 600) return 'text-amber-500';
  return 'text-red-500';
}

function formatAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [_, y, mo, d] = m;
  return `${Number(mo)}/${Number(d)}/${y}`;
}

interface ScoreHistoryEntry {
  id: string;
  bureau: string;
  score: number;
  score_date: string;
}

function ManualScoreEditor({
  clientId,
  bureau,
  initialScore,
  initialAsOf,
  existing,
  onDone,
}: {
  clientId: string;
  bureau: ScoreBureau;
  initialScore?: number;
  initialAsOf?: string | null;
  existing: CreditScoresMap;
  onDone: () => void;
}) {
  const [scoreStr, setScoreStr] = useState(initialScore ? String(initialScore) : '');
  const [asOf, setAsOf] = useState<string>(initialAsOf || new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const score = Number(scoreStr);
    if (!Number.isFinite(score) || score < 300 || score > 900) {
      toast.error('Score must be between 300 and 900');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      toast.error('Date must be YYYY-MM-DD');
      return;
    }
    setSaving(true);
    try {
      const { merged } = mergeCreditScores(existing, [{ bureau, score, as_of: asOf }]);
      // Force-overwrite the bureau entry (manual edits always win)
      merged[bureau] = { score, as_of: asOf };
      const { error } = await supabase
        .from('clients')
        .update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          credit_scores: merged as any,
          scores_updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);
      if (error) throw error;
      await supabase.from('score_history').insert({
        client_id: clientId,
        bureau: bureauDisplayName(bureau),
        score,
        score_date: asOf,
        source: 'manual',
      } as never);
      toast.success(`${bureauDisplayName(bureau)} score saved`);
      onDone();
    } catch (e) {
      toast.error('Save failed: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-1 w-56">
      <div className="space-y-1">
        <Label className="text-xs">{bureauDisplayName(bureau)} score</Label>
        <Input
          type="number"
          min={300}
          max={900}
          value={scoreStr}
          onChange={(e) => setScoreStr(e.target.value)}
          placeholder="e.g. 640"
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">As of</Label>
        <Input
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          className="h-8"
        />
      </div>
      <Button size="sm" className="w-full h-8" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}

function ScoreCard({
  bureau,
  entry,
  baseline,
  clientId,
  existing,
  onChanged,
}: {
  bureau: ScoreBureau;
  entry: { score: number; as_of: string | null } | undefined;
  baseline: number | null;
  clientId: string;
  existing: CreditScoresMap;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const score = entry?.score ?? null;
  const asOf = formatAsOf(entry?.as_of);
  const delta = score && baseline && score !== baseline ? score - baseline : null;
  const TrendIcon = delta === null ? null : delta > 0 ? TrendingUp : TrendingDown;
  const trendColor = delta === null ? '' : delta > 0 ? 'text-emerald-500' : 'text-red-500';

  // C4 — score-trend interpretation (heuristic). Recomputed on score updates.
  const { data: interp } = useQuery<ScoreTrendInterpretation | null>({
    queryKey: ['score-trend-interp', clientId, bureau, score, entry?.as_of],
    queryFn: () =>
      score == null
        ? Promise.resolve(null)
        : interpretScoreTrend(clientId, bureau, score, entry?.as_of ?? null),
    enabled: score != null,
    staleTime: 60_000,
  });

  return (
    <div className="relative text-center p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-center gap-1 mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {bureauDisplayName(bureau)}
        </p>
        {score !== null && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-auto">
              <ManualScoreEditor
                clientId={clientId}
                bureau={bureau}
                initialScore={entry?.score}
                initialAsOf={entry?.as_of}
                existing={existing}
                onDone={() => { setOpen(false); onChanged(); }}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <p className={`text-3xl font-bold ${scoreColor(score)}`}>
        {score ?? 'N/A'}
      </p>
      {asOf ? (
        <p className="text-[11px] text-muted-foreground mt-1">as of {asOf}</p>
      ) : score === null ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="text-[11px] text-primary hover:underline mt-1">
              Add manually
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-auto">
            <ManualScoreEditor
              clientId={clientId}
              bureau={bureau}
              existing={existing}
              onDone={() => { setOpen(false); onChanged(); }}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-1">date unknown</p>
      )}
      {delta !== null && TrendIcon && (
        <div className={`flex items-center justify-center gap-1 mt-1.5 text-[11px] ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          <span>{delta > 0 ? '+' : ''}{delta} pts since intake</span>
        </div>
      )}
      {delta !== null && <ScoreTrendWhy interp={interp ?? null} />}
    </div>
  );
}

export function CreditScoresPanel({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ['client-credit-scores', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('credit_scores')
        .eq('id', clientId)
        .maybeSingle();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['score_history', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('score_history')
        .select('id,bureau,score,score_date')
        .eq('client_id', clientId)
        .order('score_date', { ascending: true })
        .limit(200);
      return (data ?? []) as ScoreHistoryEntry[];
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scores = (client?.credit_scores ?? {}) as CreditScoresMap;

  // Baseline = earliest recorded score per bureau (intake anchor).
  const baselineFor = (bureau: ScoreBureau): number | null => {
    const display = bureauDisplayName(bureau).toLowerCase();
    const entries = history.filter(h => h.bureau?.toLowerCase() === display);
    if (entries.length < 2) return null; // need at least 2 distinct entries to show delta
    return entries[0].score;
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['client-credit-scores', clientId] });
    queryClient.invalidateQueries({ queryKey: ['score_history', clientId] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Credit Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {(['equifax', 'experian', 'transunion'] as ScoreBureau[]).map(b => (
            <ScoreCard
              key={b}
              bureau={b}
              entry={scores[b]}
              baseline={baselineFor(b)}
              clientId={clientId}
              existing={scores}
              onChanged={refresh}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
