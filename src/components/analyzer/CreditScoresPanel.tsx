import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScoreEntry {
  id: string;
  bureau: string;
  score: number;
  score_date: string;
  created_at: string;
  source: string | null;
}

function getScoreColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 740) return 'text-green-500';
  if (score >= 670) return 'text-yellow-500';
  if (score >= 580) return 'text-orange-500';
  return 'text-red-500';
}

function getScoreLabel(score: number | null): string {
  if (!score) return 'N/A';
  if (score >= 740) return 'Excellent';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}

function ScoreCard({ bureau, current, previous }: { bureau: string; current: number | null; previous: number | null }) {
  const diff = current && previous ? current - previous : null;
  const TrendIcon = diff === null ? Minus : diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendColor = diff === null ? 'text-muted-foreground' : diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="text-center p-4 rounded-lg border bg-card">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{bureau}</p>
      <p className={`text-3xl font-bold ${getScoreColor(current)}`}>
        {current ?? '—'}
      </p>
      <Badge variant="outline" className="mt-1 text-xs">
        {getScoreLabel(current)}
      </Badge>
      {diff !== null && (
        <div className={`flex items-center justify-center gap-1 mt-2 text-xs ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          <span>{diff > 0 ? '+' : ''}{diff} pts</span>
        </div>
      )}
    </div>
  );
}

export function CreditScoresPanel({ clientId }: { clientId: string }) {
  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('equifax_score, experian_score, transunion_score').eq('id', clientId).maybeSingle();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['score_history', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('score_history')
        .select('*')
        .eq('client_id', clientId)
        .order('score_date', { ascending: false })
        .limit(30);
      return (data ?? []) as ScoreEntry[];
    },
  });

  // Get previous scores (second most recent per bureau)
  const getPrevious = (bureau: string) => {
    const entries = history.filter(h => h.bureau.toLowerCase() === bureau.toLowerCase());
    return entries.length > 1 ? entries[1].score : null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Credit Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <ScoreCard bureau="Equifax" current={client?.equifax_score ?? null} previous={getPrevious('Equifax')} />
          <ScoreCard bureau="Experian" current={client?.experian_score ?? null} previous={getPrevious('Experian')} />
          <ScoreCard bureau="TransUnion" current={client?.transunion_score ?? null} previous={getPrevious('TransUnion')} />
        </div>
      </CardContent>
    </Card>
  );
}
