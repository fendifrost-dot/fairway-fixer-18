/**
 * Intake Auto-Extract orchestrator (B3)
 *
 * Single-step intake flow: given a freshly created clientId and the verbatim
 * narrative, call the extract-intake edge function to get (a) structured
 * identity fields and (b) a parser-compatible structured_blob, then run the
 * SAME deterministic-parser → mapper → ensureRound → bulk insert pipeline used
 * by ChatGPTImport for follow-up updates.
 *
 * Returns counts of what was imported. Throws on hard failure (caller may
 * choose to swallow — the client itself is already saved).
 */

import { supabase } from '@/integrations/supabase/client';
import { parseUpdate } from '@/lib/parser';
import { mapTimelineEventToDb } from '@/lib/importRouting';
import { ensureRound } from '@/hooks/useDisputeRounds';
import type { ScheduledEvent } from '@/types/parser';
import type { OperatorTask, SimplePriority } from '@/types/operator';
import { extractScoresFromLines, ExtractedScore, ScoreBureau } from '@/lib/scoreExtraction';
import { applyExtractedScores } from '@/lib/applyExtractedScores';
import { resolveFurnishersForEvents } from '@/lib/resolveFurnishers';
import { resolveTradelinesForEvents } from '@/lib/resolveTradelines';
import { ensureTradeline } from '@/hooks/useTradelines';
import type { TradelineBureau } from '@/types/operator';
import { parseAttachmentLines } from '@/lib/attachmentDetector';
import { persistAttachmentsForEvents } from '@/hooks/useEventAttachments';

export interface AutoExtractResult {
  events: number;
  tasks: number;
  rounds: number;
  identityFieldsFilled: number;
  scoresUpdated: number;
  tradelines: number;
  attachmentsCreated: number;
  errors: string[];
}

function mapScheduledEventToTask(
  ev: ScheduledEvent,
  clientId: string
): Omit<OperatorTask, 'id' | 'created_at'> {
  const priorityMap: Record<string, SimplePriority> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  return {
    client_id: clientId,
    title: ev.description.slice(0, 200),
    due_date: ev.due_date,
    due_time: null,
    notes: ev.due_text && !ev.due_date ? ev.due_text : null,
    linked_event_ids: [],
    recurrence_rule: null,
    priority: priorityMap[ev.priority] ?? 'Medium',
    status: 'Open',
  };
}

export async function autoExtractIntake(
  clientId: string,
  narrative: string
): Promise<AutoExtractResult> {
  const result: AutoExtractResult = {
    events: 0,
    tasks: 0,
    rounds: 0,
    identityFieldsFilled: 0,
    scoresUpdated: 0,
    tradelines: 0,
    attachmentsCreated: 0,
    errors: [],
  };

  if (!narrative || !narrative.trim()) return result;

  // 1) Call edge function
  const { data, error } = await supabase.functions.invoke('extract-intake', {
    body: { narrative },
  });
  if (error) {
    result.errors.push(error.message);
    return result;
  }
  if (data?.error) {
    result.errors.push(String(data.error));
    return result;
  }

  const identity = (data?.identity ?? {}) as {
    dob?: string | null;
    current_address?: string | null;
    ssn_last4?: string | null;
    phone?: string | null;
    email?: string | null;
    alternate_addresses?: string[];
  };
  const blob: string = typeof data?.structured_blob === 'string' ? data.structured_blob : '';
  const rawScores = (data?.credit_scores ?? {}) as Record<
    string,
    { score?: number; as_of?: string | null } | undefined
  >;
  const rawTradelines = Array.isArray(data?.tradelines)
    ? (data.tradelines as Array<{
        display_name?: string;
        account_last4?: string | null;
        bureaus?: Partial<Record<TradelineBureau, { present?: boolean; status_on_bureau?: string | null; last_seen_date?: string | null }>>;
      }>)
    : [];
  const rawEventAttachments = Array.isArray(data?.event_attachments)
    ? (data.event_attachments as Array<{ raw_line?: string; attachments?: string[] }>)
    : [];

  // 2) Patch client identity (only fields the model returned non-null)
  const updates: Record<string, unknown> = {};
  if (identity.dob) { updates.date_of_birth = identity.dob; result.identityFieldsFilled++; }
  if (identity.current_address) { updates.current_address = identity.current_address; result.identityFieldsFilled++; }
  if (identity.ssn_last4) { updates.ssn_last4 = identity.ssn_last4; result.identityFieldsFilled++; }
  if (identity.phone) { updates.phone = identity.phone; result.identityFieldsFilled++; }
  if (identity.email) { updates.email = identity.email; result.identityFieldsFilled++; }
  if (Array.isArray(identity.alternate_addresses) && identity.alternate_addresses.length > 0) {
    updates.alternate_addresses = identity.alternate_addresses;
    result.identityFieldsFilled++;
  }
  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId);
    if (updErr) result.errors.push('identity update: ' + updErr.message);
  }

  // 3) Parse the structured blob using the existing deterministic parser
  if (!blob.trim()) return result;

  const parsed = parseUpdate(blob, clientId);

  // 4) Map timeline events → DB rows; resolve [Round N] → round_id
  const dbEvents = parsed.timeline_events.map(e => mapTimelineEventToDb(e, clientId));
  const uniqueRoundNumbers = Array.from(
    new Set(
      dbEvents
        .map(e => e.round_number)
        .filter((n): n is number => typeof n === 'number' && n > 0)
    )
  );
  if (uniqueRoundNumbers.length > 0) {
    const roundMap = new Map<number, string>();
    for (const n of uniqueRoundNumbers) {
      try {
        const round = await ensureRound(clientId, n);
        roundMap.set(n, round.id);
        result.rounds++;
      } catch (err) {
        result.errors.push(`round ${n}: ${(err as Error).message}`);
      }
    }
    for (const e of dbEvents) {
      if (e.round_number && roundMap.has(e.round_number)) {
        e.round_id = roundMap.get(e.round_number) ?? null;
      }
      delete e.round_number;
    }
  } else {
    dbEvents.forEach(e => { delete e.round_number; });
  }

  // B4: Resolve furnisher_name → furnisher_id before insert.
  try {
    const { errors: fErrs } = await resolveFurnishersForEvents(clientId, dbEvents);
    if (fErrs.length > 0) result.errors.push(...fErrs);
  } catch (e) {
    result.errors.push('furnisher resolve: ' + (e as Error).message);
  }

  // B5: Resolve [Tradeline: "..."] anchors from parsed events.
  try {
    const { errors: tErrs } = await resolveTradelinesForEvents(clientId, dbEvents);
    if (tErrs.length > 0) result.errors.push(...tErrs);
  } catch (e) {
    result.errors.push('tradeline resolve: ' + (e as Error).message);
  }

  // 5) Bulk insert events
  if (dbEvents.length > 0) {
    const valid = dbEvents.filter(e => e.raw_line && e.raw_line.trim().length > 0);
    if (valid.length > 0) {
      const { error: evErr } = await supabase
        .from('timeline_events')
        .insert(valid as any);
      if (evErr) {
        result.errors.push('events insert: ' + evErr.message);
      } else {
        result.events = valid.length;
      }

      // B7: Persist parser-detected + AI-returned attachments per event.
      try {
        // Build attachments-by-raw_line map, merging parser + AI sources.
        const byRawLine = new Map<string, Array<{
          drive_path: string;
          file_url: string | null;
          mime_type: string;
          file_name: string;
        }>>();
        for (const e of valid) {
          if (e.parsed_attachments && e.parsed_attachments.length > 0) {
            byRawLine.set(e.raw_line, [...(byRawLine.get(e.raw_line) || []), ...e.parsed_attachments]);
          }
        }
        for (const entry of rawEventAttachments) {
          const rl = entry.raw_line?.trim();
          if (!rl || !Array.isArray(entry.attachments) || entry.attachments.length === 0) continue;
          const parsed = parseAttachmentLines(entry.attachments.join('\n'));
          if (parsed.length === 0) continue;
          byRawLine.set(rl, [...(byRawLine.get(rl) || []), ...parsed]);
        }
        if (byRawLine.size > 0) {
          const rawLines = Array.from(byRawLine.keys());
          const { data: rows } = await supabase
            .from('timeline_events')
            .select('id, raw_line')
            .eq('client_id', clientId)
            .in('raw_line', rawLines);
          const rawToId = new Map<string, string>();
          (rows ?? []).forEach((r: { id: string; raw_line: string }) => rawToId.set(r.raw_line, r.id));
          const byEventId: Record<string, Array<{
            drive_path: string;
            file_url: string | null;
            mime_type: string;
            file_name: string;
          }>> = {};
          for (const [rl, atts] of byRawLine.entries()) {
            const id = rawToId.get(rl);
            if (!id) continue;
            // dedupe by drive_path|file_url
            const seen = new Set<string>();
            const unique = atts.filter(a => {
              const k = `${a.drive_path}|${a.file_url ?? ''}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            byEventId[id] = unique;
          }
          if (Object.keys(byEventId).length > 0) {
            const { inserted, errors: aErrs } = await persistAttachmentsForEvents(clientId, byEventId);
            result.attachmentsCreated = inserted;
            if (aErrs.length > 0) result.errors.push(...aErrs);
          }
        }
      } catch (e) {
        result.errors.push('attachments persist: ' + (e as Error).message);
      }
    }
  }

  // 6) Bulk insert tasks
  if (parsed.scheduled_events.length > 0) {
    const dbTasks = parsed.scheduled_events.map(e => mapScheduledEventToTask(e, clientId));
    const { error: tErr } = await supabase
      .from('operator_tasks')
      .insert(dbTasks);
    if (tErr) {
      result.errors.push('tasks insert: ' + tErr.message);
    } else {
      result.tasks = dbTasks.length;
    }
  }

  // 7) Mark client as auto-extracted (powers 24h badge)
  await supabase
    .from('clients')
    .update({ intake_auto_extracted_at: new Date().toISOString() })
    .eq('id', clientId);

  // 8) Apply credit scores: prefer the AI-returned credit_scores, then
  //    augment by scanning the parsed event raw_lines deterministically.
  const incoming: ExtractedScore[] = [];
  for (const bureau of ['equifax', 'experian', 'transunion'] as ScoreBureau[]) {
    const entry = rawScores[bureau];
    if (entry && typeof entry.score === 'number' && entry.score >= 300 && entry.score <= 900) {
      incoming.push({
        bureau,
        score: Math.round(entry.score),
        as_of: typeof entry.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.as_of)
          ? entry.as_of
          : null,
      });
    }
  }
  // Also scan parsed timeline raw_lines for any explicitly-stated scores.
  const fromLines = extractScoresFromLines(parsed.timeline_events.map(e => e.raw_line).filter(Boolean));
  for (const s of fromLines) {
    // Only add if AI didn't already cover that bureau
    if (!incoming.find(i => i.bureau === s.bureau)) incoming.push(s);
  }
  if (incoming.length > 0) {
    const { updated, errors: scoreErrs } = await applyExtractedScores(clientId, incoming, 'intake-auto-extract');
    result.scoresUpdated = updated;
    result.errors.push(...scoreErrs);
  }

  // B5: Persist any tradelines + per-bureau states the AI returned explicitly.
  if (rawTradelines.length > 0) {
    const tdb = (supabase as any).from('tradeline_bureau_states');
    for (const tl of rawTradelines) {
      const name = tl.display_name?.trim();
      if (!name) continue;
      try {
        const tradeline = await ensureTradeline(clientId, name, tl.account_last4 ?? null);
        result.tradelines++;
        const bureaus = tl.bureaus || {};
        const rows: Array<Record<string, unknown>> = [];
        for (const b of ['equifax', 'experian', 'transunion'] as TradelineBureau[]) {
          const entry = bureaus[b];
          if (!entry) continue;
          rows.push({
            tradeline_id: tradeline.id,
            bureau: b,
            present: !!entry.present,
            status_on_bureau: entry.status_on_bureau ?? null,
            last_seen_date:
              typeof entry.last_seen_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.last_seen_date)
                ? entry.last_seen_date
                : null,
          });
        }
        if (rows.length > 0) {
          const { error: bErr } = await tdb.upsert(rows, { onConflict: 'tradeline_id,bureau' });
          if (bErr) result.errors.push(`tradeline_bureau_states "${name}": ${bErr.message}`);
        }
      } catch (e) {
        result.errors.push(`tradeline "${name}": ${(e as Error).message}`);
      }
    }
  }

  return result;
}