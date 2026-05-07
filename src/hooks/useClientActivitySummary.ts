import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientActivitySummary {
  lastActive: string | null; // ISO timestamp
  signalCount: number; // undismissed diagnostic signals
}

export type ActivitySummaryMap = Record<string, ClientActivitySummary>;

const tbl = (name: string) => (supabase as any).from(name);

function maxIso(...vals: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of vals) {
    if (!v) continue;
    if (!best || v > best) best = v;
  }
  return best;
}

/**
 * Returns last-activity timestamp + undismissed signal count for every client.
 * "Last active" = most recent of: timeline_event.event_date,
 * tradeline.updated_at, dispute_round.updated_at, diagnostic_signal.detected_at.
 */
export function useClientActivitySummary() {
  return useQuery({
    queryKey: ['client-activity-summary'],
    queryFn: async (): Promise<ActivitySummaryMap> => {
      const [tlRes, trRes, drRes, dsRes] = await Promise.all([
        tbl('timeline_events')
          .select('client_id, event_date, date_is_unknown')
          .not('event_date', 'is', null)
          .neq('date_is_unknown', true),
        tbl('tradelines').select('client_id, updated_at'),
        tbl('dispute_rounds').select('client_id, updated_at'),
        tbl('diagnostic_signals').select('client_id, detected_at, dismissed_at'),
      ]);

      const map: ActivitySummaryMap = {};
      const ensure = (id: string) => {
        if (!map[id]) map[id] = { lastActive: null, signalCount: 0 };
        return map[id];
      };

      for (const r of (tlRes.data || []) as Array<{ client_id: string; event_date: string }>) {
        const e = ensure(r.client_id);
        // event_date is a date — push to end-of-day-ish ISO for comparison
        const iso = new Date(r.event_date + 'T00:00:00Z').toISOString();
        e.lastActive = maxIso(e.lastActive, iso);
      }
      for (const r of (trRes.data || []) as Array<{ client_id: string; updated_at: string }>) {
        const e = ensure(r.client_id);
        e.lastActive = maxIso(e.lastActive, r.updated_at);
      }
      for (const r of (drRes.data || []) as Array<{ client_id: string; updated_at: string }>) {
        const e = ensure(r.client_id);
        e.lastActive = maxIso(e.lastActive, r.updated_at);
      }
      for (const r of (dsRes.data || []) as Array<{ client_id: string; detected_at: string; dismissed_at: string | null }>) {
        const e = ensure(r.client_id);
        e.lastActive = maxIso(e.lastActive, r.detected_at);
        if (!r.dismissed_at) e.signalCount += 1;
      }

      return map;
    },
    staleTime: 30_000,
  });
}

/**
 * Format a timestamp as a relative "last active" label.
 * Returns "today", "yesterday", "N days ago", "N weeks ago", "N months ago",
 * or for anything older than ~3 months, falls back to a "MMM yyyy" string.
 */
export function formatLastActive(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const ms = now.getTime() - then.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(ms / day);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? '1 week ago' : `${w} weeks ago`;
  }
  if (days < 90) {
    const m = Math.max(1, Math.floor(days / 30));
    return m === 1 ? '1 month ago' : `${m} months ago`;
  }
  // Older than ~3 months — show absolute month/year
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[then.getMonth()]} ${then.getFullYear()}`;
}