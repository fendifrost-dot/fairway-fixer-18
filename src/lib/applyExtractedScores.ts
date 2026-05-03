/**
 * Apply extracted credit scores to the database.
 *
 * - Reads the current clients.credit_scores
 * - Merges incoming scores (most-recent-per-bureau wins by as_of)
 * - Writes the merged JSON back to clients.credit_scores
 * - Mirrors each *new* score into score_history for delta tracking
 */

import { supabase } from '@/integrations/supabase/client';
import {
  CreditScoresMap,
  ExtractedScore,
  bureauDisplayName,
  mergeCreditScores,
} from '@/lib/scoreExtraction';

export async function applyExtractedScores(
  clientId: string,
  incoming: ExtractedScore[],
  source: string = 'auto-extract'
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  if (incoming.length === 0) return { updated: 0, errors };

  const { data: existing, error: readErr } = await supabase
    .from('clients')
    .select('credit_scores')
    .eq('id', clientId)
    .maybeSingle();
  if (readErr) {
    errors.push('read credit_scores: ' + readErr.message);
    return { updated: 0, errors };
  }

  const current = (existing?.credit_scores ?? {}) as CreditScoresMap;
  const { merged, changed } = mergeCreditScores(current, incoming);

  if (changed.length === 0) return { updated: 0, errors };

  const { error: updErr } = await supabase
    .from('clients')
    .update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      credit_scores: merged as any,
      scores_updated_at: new Date().toISOString(),
    })
    .eq('id', clientId);
  if (updErr) errors.push('update credit_scores: ' + updErr.message);

  // Mirror to score_history (one row per changed bureau). Use today's date
  // when the score has no explicit as_of so the entry still anchors on a date.
  const today = new Date().toISOString().slice(0, 10);
  const historyRows = changed
    .map((b) => {
      const rec = merged[b];
      if (!rec) return null;
      return {
        client_id: clientId,
        bureau: bureauDisplayName(b),
        score: rec.score,
        score_date: rec.as_of || today,
        source,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (historyRows.length > 0) {
    const { error: histErr } = await supabase.from('score_history').insert(historyRows as never);
    if (histErr) errors.push('score history insert: ' + histErr.message);
  }

  return { updated: changed.length, errors };
}