/**
 * C5 — generate-dispute-letter edge function.
 *
 * Inputs (JSON body):
 *   { client_id, round_number, letter_type, bureau?, furnisher_id?, signal_id? }
 *
 * Output (200):
 *   { letter_url, storage_path, event_id, attachment_id, summary, item_count }
 *
 * Side effects:
 *   1. Generates a .docx in-memory using the `docx` package.
 *   2. Uploads to the `client-letters` bucket at
 *      {client_id}/{round_number}/{letter_type}-{recipient_slug}-{date}.docx
 *   3. Inserts a timeline_events row (category=Action, kind=action) and a
 *      timeline_event_attachments row pointing at the storage object.
 *   4. Returns a 1-hour signed URL for the operator to download immediately.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// `docx` runs in Deno via esm.sh.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'https://esm.sh/docx@8.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type LetterType =
  | 'round_n_initial'
  | 'verify_or_delete'
  | 'overdue_violation'
  | 'data_broker_followup'
  | 'furnisher_direct';

const LETTER_TITLES: Record<LetterType, string> = {
  round_n_initial: 'Initial Dispute Letter',
  verify_or_delete: 'Method-of-Verification Demand (Verify or Delete)',
  overdue_violation: 'Notice of §1681i 30-Day Violation',
  data_broker_followup: 'Data-Broker Follow-Up',
  furnisher_direct: 'Direct Dispute to Furnisher (§1681s-2(b))',
};

const CITATIONS: Record<LetterType, string[]> = {
  round_n_initial: ['15 U.S.C. § 1681i (reinvestigation)'],
  verify_or_delete: [
    '15 U.S.C. § 1681i(a)(7) (method of verification)',
    '15 U.S.C. § 1681i(a)(5)(A)(i) (deletion if not reverified)',
    'Cushman v. TransUnion Corp., 115 F.3d 220 (3d Cir. 1997)',
  ],
  overdue_violation: [
    '15 U.S.C. § 1681i(a)(1) (30-day investigation window)',
    '15 U.S.C. § 1681i(a)(5)(A)(i) (deletion required)',
  ],
  data_broker_followup: [
    '15 U.S.C. § 1681e(b) (maximum possible accuracy)',
    '15 U.S.C. § 1681i (reinvestigation)',
  ],
  furnisher_direct: [
    '15 U.S.C. § 1681s-2(b) (furnisher duties on notice of dispute)',
    '15 U.S.C. § 1681c(c)(1) (re-aging / obsolete reinsertion)',
  ],
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

function bureauKey(b: string): string {
  return b.toLowerCase().replace(/\s+/g, '');
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function p(text: string, opts: { bold?: boolean; heading?: typeof HeadingLevel[keyof typeof HeadingLevel] } = {}): Paragraph {
  return new Paragraph({
    heading: opts.heading,
    children: [new TextRun({ text, bold: opts.bold })],
  });
}

interface Identity {
  legal_name: string;
  date_of_birth: string | null;
  current_address: string | null;
  ssn_last4: string | null;
  phone: string | null;
  email: string | null;
  alternate_addresses: string[] | null;
}

function identityBlock(id: Identity): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(p(id.legal_name, { bold: true }));
  if (id.date_of_birth) out.push(p(`DOB: ${id.date_of_birth}`));
  if (id.ssn_last4) out.push(p(`SSN (last 4): xxx-xx-${id.ssn_last4}`));
  if (id.current_address) out.push(p(id.current_address));
  if (id.phone) out.push(p(`Phone: ${id.phone}`));
  if (id.email) out.push(p(`Email: ${id.email}`));
  if (id.alternate_addresses && id.alternate_addresses.length > 0) {
    out.push(p('Prior addresses on file:', { bold: true }));
    for (const a of id.alternate_addresses) out.push(p(`  • ${a}`));
  }
  return out;
}

function recipientHeader(name: string): Paragraph[] {
  return [
    p(name, { bold: true }),
    p('[Address on file]'),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  ];
}

interface LetterTarget {
  display_name: string;
  account_last4: string | null;
  status_on_bureau?: string | null;
  opened_date?: string | null;
  balance?: number | null;
  evidence_note?: string | null;
}

function targetBlock(t: LetterTarget): Paragraph[] {
  const accLine = t.account_last4 ? `Account ending ${t.account_last4}` : 'Account number on file';
  const detail: string[] = [];
  if (t.opened_date) detail.push(`opened ${t.opened_date}`);
  if (t.balance != null) detail.push(`reported balance $${t.balance}`);
  if (t.status_on_bureau) detail.push(`current status: ${t.status_on_bureau}`);
  const out: Paragraph[] = [];
  out.push(p(`• ${t.display_name} — ${accLine}`, { bold: true }));
  if (detail.length > 0) out.push(p(`    ${detail.join('; ')}.`));
  if (t.evidence_note) out.push(p(`    ${t.evidence_note}`));
  return out;
}

function citationsBlock(letterType: LetterType): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(p('Statutory authority', { bold: true }));
  for (const c of CITATIONS[letterType]) out.push(p(`  • ${c}`));
  return out;
}

interface BodyArgs {
  letter_type: LetterType;
  round_number: number;
  bureau_or_furnisher_name: string;
  identity: Identity;
  targets: LetterTarget[];
  diagnostic_notes: string[];
  round_submitted_at: string | null;
}

function bodyParagraphs(args: BodyArgs): Paragraph[] {
  const out: Paragraph[] = [];
  switch (args.letter_type) {
    case 'round_n_initial':
      out.push(p(
        `Pursuant to 15 U.S.C. § 1681i, I am disputing the following ${args.targets.length} ` +
        `item(s) on my consumer file at ${args.bureau_or_furnisher_name}. ` +
        `These items are inaccurate and/or unverifiable and must be reinvestigated within 30 days.`
      ));
      break;
    case 'verify_or_delete':
      out.push(p(
        `In Round ${args.round_number}, the following item(s) were reported as "verified" or "updated" ` +
        `with no documentation, no method-of-verification disclosed, and no underlying account changes. ` +
        `Pursuant to 15 U.S.C. § 1681i(a)(7) and Cushman v. TransUnion, I demand that you provide ` +
        `the method of verification, the business name and address of any furnisher contacted, and the ` +
        `documentation reviewed. If you cannot provide this within 15 days, you must delete each item ` +
        `under § 1681i(a)(5)(A)(i).`
      ));
      break;
    case 'overdue_violation':
      out.push(p(
        `On ${args.round_submitted_at ?? '[mailing date on file]'} I submitted a dispute (Round ${args.round_number}) ` +
        `to ${args.bureau_or_furnisher_name}. More than 30 days have elapsed and I have received no ` +
        `reinvestigation results. Under 15 U.S.C. § 1681i(a)(1) and § 1681i(a)(5)(A)(i), the disputed ` +
        `items below must now be deleted from my consumer file.`
      ));
      break;
    case 'data_broker_followup':
      out.push(p(
        `Pursuant to 15 U.S.C. §§ 1681e(b) and 1681i, I am following up on previously submitted disputes ` +
        `regarding the items below. Please reinvestigate and produce the underlying source documentation.`
      ));
      break;
    case 'furnisher_direct':
      out.push(p(
        `Pursuant to 15 U.S.C. § 1681s-2(b), I am directly disputing the following account(s) with you ` +
        `as the furnisher. You must conduct a reasonable investigation, review all relevant information, ` +
        `and report results to each consumer reporting agency. Reinsertion of obsolete information ` +
        `violates § 1681c(c)(1).`
      ));
      break;
  }

  out.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  out.push(p('Disputed items', { bold: true }));
  for (const t of args.targets) {
    for (const para of targetBlock(t)) out.push(para);
  }

  if (args.diagnostic_notes.length > 0) {
    out.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    out.push(p('Supporting evidence and diagnostic findings', { bold: true }));
    for (const n of args.diagnostic_notes) out.push(p(`  • ${n}`));
  }

  out.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  for (const para of citationsBlock(args.letter_type)) out.push(para);

  out.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  out.push(p('Sincerely,'));
  out.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  out.push(p(args.identity.legal_name, { bold: true }));
  return out;
}

async function buildDocx(args: BodyArgs): Promise<Uint8Array> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: LETTER_TITLES[args.letter_type], bold: true })],
          }),
          new Paragraph({ children: [new TextRun({ text: `Date: ${todayISO()}` })] }),
          new Paragraph({ children: [new TextRun({ text: '' })] }),
          ...identityBlock(args.identity),
          new Paragraph({ children: [new TextRun({ text: '' })] }),
          ...recipientHeader(args.bureau_or_furnisher_name),
          ...bodyParagraphs(args),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return err(401, 'Unauthorized — missing token');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user?.id) return err(401, 'Unauthorized — invalid token');

    const body = await req.json();
    const client_id: string = body.client_id;
    const round_number: number = Number(body.round_number);
    const letter_type: LetterType = body.letter_type;
    const bureau: string | null = body.bureau ?? null;
    const furnisher_id: string | null = body.furnisher_id ?? null;
    const signal_id: string | null = body.signal_id ?? null;

    if (!client_id || !letter_type || !Number.isFinite(round_number)) {
      return err(400, 'client_id, round_number, and letter_type are required');
    }
    if (letter_type === 'furnisher_direct' && !furnisher_id) {
      return err(400, 'furnisher_id is required for furnisher_direct');
    }
    if (letter_type !== 'furnisher_direct' && !bureau) {
      return err(400, 'bureau is required for this letter_type');
    }

    // 1. Identity
    const { data: client, error: cErr } = await supabase
      .from('clients')
      .select('legal_name,date_of_birth,current_address,ssn_last4,phone,email,alternate_addresses')
      .eq('id', client_id)
      .maybeSingle();
    if (cErr) return err(500, cErr.message);
    if (!client) return err(404, 'Client not found');
    const identity: Identity = {
      legal_name: (client as any).legal_name,
      date_of_birth: (client as any).date_of_birth,
      current_address: (client as any).current_address,
      ssn_last4: (client as any).ssn_last4,
      phone: (client as any).phone,
      email: (client as any).email,
      alternate_addresses: (client as any).alternate_addresses ?? [],
    };

    // 2. Round (find or create by round_number)
    let round_id: string | null = null;
    let round_submitted_at: string | null = null;
    {
      const { data: existing } = await supabase
        .from('dispute_rounds')
        .select('id,submitted_at,round_number')
        .eq('client_id', client_id)
        .eq('round_number', round_number)
        .maybeSingle();
      if (existing) {
        round_id = (existing as any).id;
        round_submitted_at = (existing as any).submitted_at;
      } else {
        const { data: created, error: rErr } = await supabase
          .from('dispute_rounds')
          .insert({ client_id, round_number, status: 'planning' })
          .select('id,submitted_at')
          .single();
        if (rErr) return err(500, rErr.message);
        round_id = (created as any).id;
      }
    }

    // 3. Recipient name
    let recipient_name = bureau || 'Recipient';
    if (letter_type === 'furnisher_direct' && furnisher_id) {
      const { data: f } = await supabase.from('furnishers').select('name').eq('id', furnisher_id).maybeSingle();
      if (f) recipient_name = (f as any).name;
    }
    const recipient_slug = slugify(recipient_name);

    // 4. Targets + diagnostic notes
    const targets: LetterTarget[] = [];
    const diagnostic_notes: string[] = [];

    const { data: tradelines = [] } = await supabase
      .from('tradelines')
      .select('id,display_name,account_last4,balance,opened_date,furnisher_id')
      .eq('client_id', client_id);
    const tlById = new Map((tradelines as any[]).map((t) => [t.id, t]));

    let states: any[] = [];
    if ((tradelines as any[]).length > 0) {
      const ids = (tradelines as any[]).map((t) => t.id);
      const { data } = await supabase
        .from('tradeline_bureau_states')
        .select('tradeline_id,bureau,present,status_on_bureau')
        .in('tradeline_id', ids);
      states = data || [];
    }

    if (letter_type === 'round_n_initial' && bureau) {
      const bk = bureauKey(bureau);
      const presentIds = new Set(
        states.filter((s) => bureauKey(s.bureau) === bk && s.present).map((s) => s.tradeline_id)
      );
      // Existing actions in this round, scoped to this bureau:
      const { data: events = [] } = await supabase
        .from('timeline_events')
        .select('tradeline_id')
        .eq('client_id', client_id)
        .eq('round_id', round_id)
        .eq('category', 'Action')
        .eq('source', bureau);
      const already = new Set((events as any[]).map((e) => e.tradeline_id).filter(Boolean));
      for (const tl of tradelines as any[]) {
        if (!presentIds.has(tl.id)) continue;
        if (already.has(tl.id)) continue;
        targets.push({
          display_name: tl.display_name,
          account_last4: tl.account_last4,
          opened_date: tl.opened_date,
          balance: tl.balance,
        });
      }
    } else if (letter_type === 'verify_or_delete' && bureau) {
      const bk = bureauKey(bureau);
      for (const s of states) {
        if (bureauKey(s.bureau) !== bk) continue;
        const status = (s.status_on_bureau || '').toLowerCase().trim();
        if (!status) continue;
        if (!['verified', 'updated', 'no change', 'confirmed'].some((t) => status.includes(t))) continue;
        const tl = tlById.get(s.tradeline_id);
        if (!tl) continue;
        targets.push({
          display_name: tl.display_name,
          account_last4: tl.account_last4,
          opened_date: tl.opened_date,
          balance: tl.balance,
          status_on_bureau: s.status_on_bureau,
        });
      }
      // Pull a related signal if provided.
      if (signal_id) {
        const { data: sig } = await supabase
          .from('diagnostic_signals')
          .select('signal_type,evidence,subject_ids')
          .eq('id', signal_id)
          .maybeSingle();
        if (sig) {
          const ev: any = (sig as any).evidence || {};
          if ((sig as any).signal_type === 'automated_reverification') {
            diagnostic_notes.push(
              `Reinvestigation response was ${ev.summary_length ?? '?'} characters with no documentation cited` +
              (ev.days_since_dispute != null ? `, ${ev.days_since_dispute} days after dispute mailing` : '') +
              `. Status verb: "${ev.status_verb_matched ?? 'verified'}".`
            );
          } else if ((sig as any).signal_type === 'furnisher_rename') {
            diagnostic_notes.push(
              `Cosmetic furnisher substitution detected: "${ev.old_display_name}" deleted and "${ev.new_display_name}" ` +
              `appeared with matching account/dates/balance. This is reinsertion of obsolete information; § 1681c(c)(1) applies.`
            );
          }
        }
      }
    } else if (letter_type === 'overdue_violation' && bureau) {
      // Use whichever tradelines were originally targeted in this round on this bureau.
      const { data: events = [] } = await supabase
        .from('timeline_events')
        .select('tradeline_id')
        .eq('client_id', client_id)
        .eq('round_id', round_id)
        .eq('category', 'Action')
        .eq('source', bureau);
      const ids = new Set((events as any[]).map((e) => e.tradeline_id).filter(Boolean));
      for (const id of ids) {
        const tl = tlById.get(id as string);
        if (tl) targets.push({
          display_name: tl.display_name,
          account_last4: tl.account_last4,
          opened_date: tl.opened_date,
          balance: tl.balance,
        });
      }
    } else if (letter_type === 'data_broker_followup' && bureau) {
      // All tradelines plus identity items.
      for (const tl of tradelines as any[]) {
        targets.push({
          display_name: tl.display_name,
          account_last4: tl.account_last4,
          opened_date: tl.opened_date,
          balance: tl.balance,
        });
      }
    } else if (letter_type === 'furnisher_direct' && furnisher_id) {
      for (const tl of tradelines as any[]) {
        if (tl.furnisher_id !== furnisher_id) continue;
        targets.push({
          display_name: tl.display_name,
          account_last4: tl.account_last4,
          opened_date: tl.opened_date,
          balance: tl.balance,
        });
      }
    }

    if (targets.length === 0) {
      // Always include at least one placeholder — operator can edit before mailing.
      targets.push({
        display_name: '[No matching tradelines found — fill in manually]',
        account_last4: null,
      });
    }

    // 5. Build docx
    const docBytes = await buildDocx({
      letter_type,
      round_number,
      bureau_or_furnisher_name: recipient_name,
      identity,
      targets,
      diagnostic_notes,
      round_submitted_at,
    });

    // 6. Upload to storage (use service role so we don't fight per-call RLS).
    const service = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const date = todayISO();
    const storage_path = `${client_id}/${round_number}/${letter_type}-${recipient_slug}-${date}.docx`;
    const { error: upErr } = await service.storage
      .from('client-letters')
      .upload(storage_path, docBytes, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });
    if (upErr) return err(500, 'Storage upload failed: ' + upErr.message);

    // 7. Signed URL (1h)
    const { data: signed, error: signErr } = await service.storage
      .from('client-letters')
      .createSignedUrl(storage_path, 3600);
    if (signErr) return err(500, 'Signed URL failed: ' + signErr.message);
    const letter_url = signed?.signedUrl || '';

    // 8. Timeline event + attachment
    const labelTitle = LETTER_TITLES[letter_type];
    const summary = `Round ${round_number} ${labelTitle} — ${targets.length} item${targets.length === 1 ? '' : 's'} disputed`;
    const raw_line =
      `${date} | ${recipient_name} | Dispute Letter | Round ${round_number} ${letter_type} | Generated, ready to mail`;
    const sourceForEvent = letter_type === 'furnisher_direct' ? 'Creditor' : (bureau || null);

    const { data: ev, error: evErr } = await service
      .from('timeline_events')
      .insert({
        client_id,
        event_date: date,
        category: 'Action',
        source: sourceForEvent,
        title: labelTitle,
        summary,
        details: diagnostic_notes.length > 0 ? diagnostic_notes.join('\n') : null,
        raw_line,
        event_kind: 'action',
        round_id,
        is_draft: false,
      })
      .select('id')
      .single();
    if (evErr) return err(500, 'Timeline insert failed: ' + evErr.message);
    const event_id = (ev as any).id as string;

    const { data: att, error: attErr } = await service
      .from('timeline_event_attachments')
      .insert({
        event_id,
        drive_path: storage_path,
        file_url: letter_url,
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_name: `${letter_type}-${recipient_slug}-${date}.docx`,
        size_bytes: docBytes.byteLength,
      })
      .select('id')
      .single();
    if (attErr) return err(500, 'Attachment insert failed: ' + attErr.message);
    const attachment_id = (att as any).id as string;

    return new Response(
      JSON.stringify({
        letter_url,
        storage_path,
        event_id,
        attachment_id,
        summary,
        item_count: targets.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[generate-dispute-letter] error', e);
    return err(500, (e as Error).message);
  }
});
