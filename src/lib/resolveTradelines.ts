/**
 * B5: Resolve tradeline_anchor → tradeline_id on a batch of DB events about
 * to be inserted. Mutates the events in place: sets `tradeline_id` and removes
 * the transient `tradeline_anchor` key.
 *
 * Mirrors resolveFurnishers — used by ChatGPTImport and intakeAutoExtract.
 */

import { ensureTradeline } from '@/hooks/useTradelines';
import type { DbTimelineEvent } from '@/lib/importRouting';

export interface TradelineResolveResult {
  resolved: number;
  errors: string[];
}

export async function resolveTradelinesForEvents(
  clientId: string,
  events: DbTimelineEvent[]
): Promise<TradelineResolveResult> {
  const errors: string[] = [];
  const cache = new Map<string, string>();
  let resolved = 0;

  for (const ev of events) {
    const anchor = ev.tradeline_anchor?.trim();
    if (!anchor) {
      delete ev.tradeline_anchor;
      continue;
    }
    const key = anchor.toLowerCase();
    let id = cache.get(key);
    if (!id) {
      try {
        const t = await ensureTradeline(clientId, anchor, null);
        id = t.id;
        cache.set(key, id);
        resolved++;
      } catch (err) {
        errors.push(`tradeline "${anchor}": ${(err as Error).message}`);
      }
    }
    if (id) ev.tradeline_id = id;
    delete ev.tradeline_anchor;
  }

  return { resolved, errors };
}