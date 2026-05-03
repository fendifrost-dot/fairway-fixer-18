/**
 * Resolve furnisher_name → furnisher_id on a batch of DB events about to be
 * inserted. Mutates the provided events in place: sets `furnisher_id` and
 * deletes the transient `furnisher_name` / `furnisher_account_last4` keys.
 *
 * Used by both ChatGPTImport (manual paste) and intakeAutoExtract (B3 single-
 * step intake) before bulk-inserting timeline_events.
 */

import { ensureFurnisher } from '@/hooks/useFurnishers';
import type { DbTimelineEvent } from '@/lib/importRouting';

export interface FurnisherResolveResult {
  /** Number of new furnisher rows touched (created or upgraded). */
  resolved: number;
  errors: string[];
}

function furnisherKey(name: string, last4: string | null): string {
  return `${name.trim().toLowerCase()}::${last4 ?? ''}`;
}

export async function resolveFurnishersForEvents(
  clientId: string,
  events: DbTimelineEvent[]
): Promise<FurnisherResolveResult> {
  const errors: string[] = [];
  const cache = new Map<string, string>(); // key → furnisher_id
  let resolved = 0;

  for (const ev of events) {
    const name = ev.furnisher_name?.trim();
    if (!name) {
      delete ev.furnisher_name;
      delete ev.furnisher_account_last4;
      continue;
    }
    const last4 = ev.furnisher_account_last4 || null;
    const key = furnisherKey(name, last4);
    let id = cache.get(key);
    if (!id) {
      try {
        const f = await ensureFurnisher(clientId, name, last4);
        id = f.id;
        cache.set(key, id);
        resolved++;
      } catch (err) {
        errors.push(`furnisher "${name}": ${(err as Error).message}`);
      }
    }
    if (id) ev.furnisher_id = id;
    delete ev.furnisher_name;
    delete ev.furnisher_account_last4;
  }

  return { resolved, errors };
}