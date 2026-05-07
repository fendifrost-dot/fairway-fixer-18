// ingest-hub-event — Credit Guardian write API (A4)
// Receives signed events from Control Hub drain worker.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Bureau (lowercase) -> source enum (PascalCase, matches DB)
const BUREAU_MAP: Record<string, string> = {
  experian: 'Experian',
  transunion: 'TransUnion',
  equifax: 'Equifax',
  innovis: 'Innovis',
  lexisnexis: 'LexisNexis',
  corelogic: 'CoreLogic',
  sagestream: 'Sagestream',
};

const EVENT_TYPE_MAP: Record<string, { category: string; event_kind: string }> = {
  responses_received: { category: 'Response', event_kind: 'response' },
  outcomes_observed: { category: 'Outcome', event_kind: 'outcome' },
  completed_actions: { category: 'Action', event_kind: 'action' },
};

export async function verifySignature(secret: string, body: string, signature: string | null): Promise<boolean> {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const provided = signature.replace(/^sha256=/, '').toLowerCase();
  if (expected.length !== provided.length) return false;
  // constant-time compare
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const v0 = new Array(bl + 1);
  const v1 = new Array(bl + 1);
  for (let i = 0; i <= bl; i++) v0[i] = i;
  for (let i = 0; i < al; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < bl; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= bl; j++) v0[j] = v1[j];
  }
  return v1[bl];
}

export function fuzzyMatchClients(
  hint: string,
  clients: Array<{ id: string; legal_name: string }>,
): Array<{ id: string; legal_name: string }> {
  const h = hint.toLowerCase().trim();
  if (!h) return [];
  const matches: Array<{ id: string; legal_name: string }> = [];
  for (const c of clients) {
    const name = (c.legal_name ?? '').toLowerCase();
    if (!name) continue;
    if (name.includes(h) || h.includes(name) || levenshtein(h, name) <= 2) {
      matches.push(c);
    }
  }
  return matches;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rawBody = await req.text();
  const secret = Deno.env.get('HUB_SIGNATURE_SECRET') ?? '';
  const sigHeader = req.headers.get('x-hub-signature');
  const ok = await verifySignature(secret, rawBody, sigHeader);
  if (!ok) return json({ error: 'invalid signature' }, 401);

  let body: any;
  try { body = JSON.parse(rawBody); }
  catch { return json({ error: 'invalid JSON' }, 400); }

  const {
    correlation_id,
    client_id,
    client_name_hint,
    bureau,
    round,
    event_type,
    summary,
    drive_path,
    drive_url,
    mime_type,
    ocr_text,
  } = body ?? {};

  if (!correlation_id || typeof correlation_id !== 'string') {
    return json({ error: 'correlation_id required' }, 400);
  }
  if (!event_type || !(event_type in EVENT_TYPE_MAP)) {
    return json({ error: 'invalid event_type' }, 400);
  }
  if (!summary || typeof summary !== 'string') {
    return json({ error: 'summary required' }, 400);
  }

  let mappedSource: string | null = null;
  if (bureau != null) {
    if (typeof bureau !== 'string' || !(bureau.toLowerCase() in BUREAU_MAP)) {
      return json({ error: 'unrecognized bureau' }, 400);
    }
    mappedSource = BUREAU_MAP[bureau.toLowerCase()];
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 7. Idempotency check first
  {
    const { data: existing, error } = await supabase
      .from('timeline_events')
      .select('id')
      .eq('correlation_id', correlation_id)
      .maybeSingle();
    if (error) return json({ error: 'db error: ' + error.message }, 500);
    if (existing) {
      const { data: att } = await supabase
        .from('timeline_event_attachments')
        .select('id')
        .eq('event_id', existing.id)
        .maybeSingle();
      return json({
        resolved: true,
        event_id: existing.id,
        attachment_id: att?.id ?? null,
        correlation_id,
        idempotent: true,
      });
    }
  }

  // 2. Resolve client
  let resolvedClientId: string | null = null;
  if (client_id) {
    const { data, error } = await supabase
      .from('clients').select('id').eq('id', client_id).maybeSingle();
    if (error) return json({ error: 'db error: ' + error.message }, 500);
    if (data) resolvedClientId = data.id;
  }
  if (!resolvedClientId) {
    if (!client_name_hint || typeof client_name_hint !== 'string') {
      return json({ resolved: false, candidates: [], reason: 'no client_id or client_name_hint' }, 422);
    }
    const { data: clients, error } = await supabase
      .from('clients').select('id, legal_name');
    if (error) return json({ error: 'db error: ' + error.message }, 500);
    const candidates = fuzzyMatchClients(client_name_hint, clients ?? []);
    if (candidates.length !== 1) {
      return json({ resolved: false, candidates }, 422);
    }
    resolvedClientId = candidates[0].id;
  }

  // 3. Resolve round
  let roundId: string | null = null;
  if (typeof round === 'number' && Number.isInteger(round) && round > 0) {
    const { data: existingRound, error: rErr } = await supabase
      .from('dispute_rounds')
      .select('id')
      .eq('client_id', resolvedClientId)
      .eq('round_number', round)
      .maybeSingle();
    if (rErr) return json({ error: 'db error: ' + rErr.message }, 500);
    if (existingRound) {
      roundId = existingRound.id;
    } else {
      const { data: created, error: cErr } = await supabase
        .from('dispute_rounds')
        .insert({ client_id: resolvedClientId, round_number: round, status: 'planning' })
        .select('id').single();
      if (cErr) return json({ error: 'db error: ' + cErr.message }, 500);
      roundId = created.id;
    }
  }

  // 5. Insert timeline_event
  const { category, event_kind } = EVENT_TYPE_MAP[event_type];
  const rawLine = JSON.stringify({
    correlation_id,
    bureau: bureau ?? null,
    round: round ?? null,
    event_type,
    summary,
    drive_path: drive_path ?? null,
    drive_url: drive_url ?? null,
    ocr_text: ocr_text ?? null,
  });
  const { data: ev, error: evErr } = await supabase
    .from('timeline_events')
    .insert({
      client_id: resolvedClientId,
      source: mappedSource,
      category,
      event_kind,
      title: summary.slice(0, 120),
      summary,
      raw_line: rawLine,
      round_id: roundId,
      date_is_unknown: true,
      correlation_id,
    })
    .select('id').single();
  if (evErr) return json({ error: 'db error: ' + evErr.message }, 500);

  // 6. Attachment
  let attachmentId: string | null = null;
  if (drive_path || drive_url) {
    const fileName = (drive_path ?? drive_url ?? '').toString().split('/').pop() || 'attachment';
    const { data: att, error: aErr } = await supabase
      .from('timeline_event_attachments')
      .insert({
        event_id: ev.id,
        drive_path: drive_path ?? drive_url ?? '',
        file_url: drive_url ?? null,
        mime_type: mime_type ?? 'application/octet-stream',
        file_name: fileName,
      })
      .select('id').single();
    if (aErr) return json({ error: 'db error: ' + aErr.message }, 500);
    attachmentId = att.id;
  }

  return json({
    resolved: true,
    event_id: ev.id,
    attachment_id: attachmentId,
    correlation_id,
  });
});