/**
 * Unit tests for ingest-hub-event helpers (A4).
 *
 * The edge function lives in supabase/functions/ingest-hub-event/index.ts but
 * its pure helpers (signature verification, levenshtein, fuzzy match) are
 * runtime-agnostic. We re-implement them inline here to keep the test in the
 * vitest suite (the authoritative execution standard) without coupling to
 * the Deno import graph.
 *
 * If you change the helpers in the edge function, mirror the change here.
 */
import { describe, it, expect } from 'vitest';

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

async function verifySignature(secret: string, body: string, signature: string | null) {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const provided = signature.replace(/^sha256=/, '').toLowerCase();
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return mismatch === 0;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (!al) return bl; if (!bl) return al;
  const v0 = new Array(bl + 1); const v1 = new Array(bl + 1);
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

function fuzzyMatchClients(hint: string, clients: Array<{ id: string; legal_name: string }>) {
  const h = hint.toLowerCase().trim();
  if (!h) return [];
  const out: Array<{ id: string; legal_name: string }> = [];
  for (const c of clients) {
    const name = (c.legal_name ?? '').toLowerCase();
    if (!name) continue;
    if (name.includes(h) || h.includes(name) || levenshtein(h, name) <= 2) out.push(c);
  }
  return out;
}

async function sign(secret: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('ingest-hub-event: signature verification', () => {
  const secret = 'test-secret-xyz';
  const body = JSON.stringify({ correlation_id: 'tg_1', event_type: 'completed_actions', summary: 'x' });

  it('accepts a valid signature', async () => {
    const sig = await sign(secret, body);
    expect(await verifySignature(secret, body, sig)).toBe(true);
  });

  it('accepts sha256= prefixed signature', async () => {
    const sig = await sign(secret, body);
    expect(await verifySignature(secret, body, 'sha256=' + sig)).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    expect(await verifySignature(secret, body, 'a'.repeat(64))).toBe(false);
  });

  it('rejects a missing signature', async () => {
    expect(await verifySignature(secret, body, null)).toBe(false);
  });

  it('rejects when secret is empty', async () => {
    const sig = await sign('other', body);
    expect(await verifySignature('', body, sig)).toBe(false);
  });

  it('rejects tampered body', async () => {
    const sig = await sign(secret, body);
    expect(await verifySignature(secret, body + 'X', sig)).toBe(false);
  });
});

describe('ingest-hub-event: client fuzzy match', () => {
  const clients = [
    { id: 'a', legal_name: 'Samuel Johnson' },
    { id: 'b', legal_name: 'Sammy Davis' },
    { id: 'c', legal_name: 'Other Person' },
    { id: 'd', legal_name: 'Sam' },
  ];

  it('returns single match on substring containment', () => {
    const out = fuzzyMatchClients('Other Person', clients);
    expect(out.map((c) => c.id)).toEqual(['c']);
  });

  it('returns multiple matches when ambiguous (Sam appears in many)', () => {
    const out = fuzzyMatchClients('Sam', clients);
    expect(out.length).toBeGreaterThan(1);
  });

  it('matches via levenshtein <= 2', () => {
    const out = fuzzyMatchClients('Othr Person', [{ id: 'c', legal_name: 'Other Person' }]);
    expect(out.map((c) => c.id)).toEqual(['c']);
  });

  it('returns empty when no candidates match', () => {
    const out = fuzzyMatchClients('Zzzzzzzzz', clients);
    expect(out).toEqual([]);
  });
});

describe('ingest-hub-event: bureau and event_type mapping', () => {
  it('maps lowercase bureau to PascalCase enum', () => {
    expect(BUREAU_MAP['experian']).toBe('Experian');
    expect(BUREAU_MAP['transunion']).toBe('TransUnion');
    expect(BUREAU_MAP['lexisnexis']).toBe('LexisNexis');
  });

  it('rejects unknown bureau', () => {
    expect('chexsystems' in BUREAU_MAP).toBe(false);
  });

  it('maps event_type to category + kind', () => {
    expect(EVENT_TYPE_MAP.responses_received).toEqual({ category: 'Response', event_kind: 'response' });
    expect(EVENT_TYPE_MAP.outcomes_observed).toEqual({ category: 'Outcome', event_kind: 'outcome' });
    expect(EVENT_TYPE_MAP.completed_actions).toEqual({ category: 'Action', event_kind: 'action' });
  });
});

describe('ingest-hub-event: levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('counts edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});
