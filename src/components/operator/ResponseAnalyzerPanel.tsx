/**
 * Response Analyzer — bureau report/response → operator-reviewed draft letter.
 * Evidence rows are loaded server-side (RLS) by the edge function.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileUp, Sparkles, Copy, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { invokeEdgeFunctionWithBody } from '@/lib/invokeEdgeFunction';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEvent, EventSource, ALL_EVIDENCE_SOURCES } from '@/types/operator';
import { maskPII } from '@/lib/piiMasker';
import { extractResponseDocumentText, supportedResponseMimeTypes } from '@/lib/responseDocumentExtract';
import { filterEvidenceForSource, summarizeEvidenceCounts } from '@/lib/bureauResponseFacts';
import {
  flaggedUnauthorizedInquiries,
  parseInquiriesFromReportText,
  type ParsedInquiry,
} from '@/lib/inquiryParse';
import {
  DisputeFocus,
  LetterMode,
  letterTypeLabel,
  suggestLetterMode,
} from '@/lib/letterAnalyzerHelpers';

interface DraftResult {
  draft_letter: string;
  opening_summary: string;
  supporting_bullets: string[];
  operator_checklist: string[];
}

interface AnalyzerMeta {
  evidence_event_count: number;
  evidence_same_source_count?: number;
  evidence_scope?: string;
  scheduled_task_count?: number;
  inquiries_parsed?: number;
  inquiries_flagged_unauthorized?: number;
  letter_mode?: LetterMode;
  dispute_focus?: DisputeFocus;
}

interface ResponseAnalyzerPanelProps {
  clientId: string;
  events: TimelineEvent[];
}

export function ResponseAnalyzerPanel({ clientId, events }: ResponseAnalyzerPanelProps) {
  const queryClient = useQueryClient();
  const [bureau, setBureau] = useState<EventSource>('Experian');
  const [responseText, setResponseText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [editedLetter, setEditedLetter] = useState('');
  const [meta, setMeta] = useState<AnalyzerMeta | null>(null);
  const [letterMode, setLetterMode] = useState<LetterMode>('initial');
  const [disputeFocus, setDisputeFocus] = useState<DisputeFocus>('auto');
  const [inquiries, setInquiries] = useState<ParsedInquiry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = filterEvidenceForSource(events, bureau);
  const stats = summarizeEvidenceCounts(filtered);
  const totalStats = summarizeEvidenceCounts(events);

  const { data: savedLetters = [] } = useQuery({
    queryKey: ['analyzer-saved-letters', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_letters')
        .select('id, letter_type, recipient_name, status, created_at, body_md')
        .eq('client_id', clientId)
        .ilike('letter_type', '%Analyzer%')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    setLetterMode(suggestLetterMode(events, bureau));
  }, [events, bureau]);

  useEffect(() => {
    if (!responseText.trim()) {
      setInquiries([]);
      return;
    }
    setInquiries(parseInquiriesFromReportText(responseText));
  }, [responseText]);

  const resolvedFocus = useMemo((): DisputeFocus => {
    if (disputeFocus !== 'auto') return disputeFocus;
    if (flaggedUnauthorizedInquiries(inquiries).length > 0) return 'inquiry';
    return 'auto';
  }, [disputeFocus, inquiries]);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setExtracting(true);
    try {
      const text = await extractResponseDocumentText(f);
      if (!text) toast.warning('No text extracted — try pasting manually');
      setResponseText(text);
      toast.success('Text extracted from file');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleInquiryUnauthorized = (id: string, checked: boolean) => {
    setInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, dispute_as_unauthorized: checked } : i))
    );
  };

  const handleCompose = async () => {
    const trimmed = responseText.trim();
    if (!trimmed) {
      toast.error('Add bureau response text (upload or paste)');
      return;
    }
    setComposing(true);
    setResult(null);
    setMeta(null);
    try {
      const { masked } = maskPII(trimmed);
      const data = await invokeEdgeFunctionWithBody<{
        result?: DraftResult;
        meta?: AnalyzerMeta;
        error?: string;
      }>('analyze-bureau-response', {
        client_id: clientId,
        bureau_source: bureau,
        response_document_text: masked,
        letter_mode: letterMode,
        dispute_focus: disputeFocus,
        flagged_inquiries: inquiries.map((i) => ({
          creditor: i.creditor,
          inquiry_date: i.inquiry_date,
          dispute_as_unauthorized: i.dispute_as_unauthorized === true,
        })),
      });
      const r = data.result;
      if (!r?.draft_letter) throw new Error('No draft returned');
      setResult(r);
      setEditedLetter(r.draft_letter);
      setMeta(data.meta ?? null);
      toast.success('Draft generated — review before sending');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setComposing(false);
    }
  };

  const handleSave = async () => {
    if (!editedLetter.trim()) {
      toast.error('Nothing to save');
      return;
    }
    setSaving(true);
    try {
      const focus = meta?.dispute_focus ?? resolvedFocus;
      const mode = meta?.letter_mode ?? letterMode;
      const { error } = await supabase.from('dispute_letters').insert({
        client_id: clientId,
        recipient_type: 'cra',
        recipient_name: bureau,
        letter_type: `Response Analyzer — ${letterTypeLabel(mode, focus === 'auto' ? 'tradeline' : focus)}`,
        body_md: editedLetter,
        status: 'draft',
        strength_checklist: {
          operator_checklist: result?.operator_checklist ?? [],
          opening_summary: result?.opening_summary ?? '',
          supporting_bullets: result?.supporting_bullets ?? [],
          analyzer_meta: meta,
        },
      });
      if (error) throw error;
      toast.success('Draft saved to client file');
      queryClient.invalidateQueries({ queryKey: ['dispute-letters', clientId] });
      queryClient.invalidateQueries({ queryKey: ['analyzer-saved-letters', clientId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyLetter = async () => {
    if (!editedLetter) return;
    await navigator.clipboard.writeText(editedLetter);
    toast.success('Copied to clipboard');
  };

  const acceptAttr = supportedResponseMimeTypes().join(',');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-accent" />
          Response Analyzer
        </CardTitle>
        <CardDescription>
          Upload or paste a bureau response or credit report excerpt. The tool loads timeline evidence and drafts a
          letter for operator review. This is <strong>not legal advice</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Operator review required</AlertTitle>
          <AlertDescription>
            Verify every fact before sending. Use <strong>Initial</strong> mode when no prior dispute exists for this
            source. Flag unauthorized inquiries below when disputing §605B/identity-theft inquiries.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Target bureau (source)</Label>
            <Select value={bureau} onValueChange={(v) => setBureau(v as EventSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_EVIDENCE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Evidence for <strong>{bureau}</strong>: <strong>{stats.total}</strong> events ({stats.actions} actions,{' '}
              {stats.responses} responses). File total: <strong>{totalStats.total}</strong> committed timeline rows.
              {stats.total === 0 && totalStats.total > 0 && (
                <span className="block mt-1 text-amber-700 dark:text-amber-400">
                  No rows tagged {bureau} — server will fall back to all-source evidence. Tag imports with the correct
                  bureau source when committing timeline events.
                </span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Upload file</Label>
            <input
              ref={fileRef}
              type="file"
              accept={acceptAttr}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={extracting}
              onClick={() => fileRef.current?.click()}
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4 mr-2" />
              )}
              Choose PDF, DOCX, image, or TXT
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Letter mode</Label>
            <Select value={letterMode} onValueChange={(v) => setLetterMode(v as LetterMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="initial">Initial dispute (first letter)</SelectItem>
                <SelectItem value="follow_up">Follow-up (prior dispute in evidence)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dispute focus</Label>
            <Select value={disputeFocus} onValueChange={(v) => setDisputeFocus(v as DisputeFocus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (prefer flagged inquiries)</SelectItem>
                <SelectItem value="tradeline">Tradeline / account accuracy</SelectItem>
                <SelectItem value="inquiry">Hard inquiry — §605B / identity theft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {inquiries.length > 0 && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">
              Inquiries detected ({inquiries.length}) — flag unauthorized for §605B dispute
            </p>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {inquiries.map((inq) => (
                <li key={inq.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id={inq.id}
                    checked={inq.dispute_as_unauthorized === true}
                    onCheckedChange={(c) => toggleInquiryUnauthorized(inq.id, c === true)}
                  />
                  <label htmlFor={inq.id} className="cursor-pointer leading-snug">
                    <span className="font-medium">{inq.creditor}</span>
                    {inq.inquiry_date && (
                      <span className="text-muted-foreground"> — {inq.inquiry_date}</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label>Bureau document text</Label>
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Paste bureau response, credit report excerpt, or inquiry scope…"
            className="min-h-[160px] font-mono text-sm"
          />
        </div>

        <Button type="button" onClick={handleCompose} disabled={composing} className="bg-accent hover:bg-accent/90">
          {composing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate draft letter
        </Button>

        {savedLetters.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved analyzer drafts</p>
            {savedLetters.map((l) => (
              <div key={l.id} className="flex justify-between items-center text-sm gap-2">
                <span className="truncate">{l.letter_type as string}</span>
                <Badge variant="outline">{l.recipient_name as string}</Badge>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-4 pt-2 border-t border-border">
            {meta && (
              <p className="text-xs text-muted-foreground">
                Evidence: <strong>{meta.evidence_event_count}</strong> row(s)
                {meta.evidence_scope === 'all_sources_fallback' && ' (all sources — none tagged for this bureau)'}
                {meta.scheduled_task_count != null && meta.scheduled_task_count > 0 && (
                  <> · <strong>{meta.scheduled_task_count}</strong> scheduled task(s) included as context</>
                )}
                {meta.inquiries_flagged_unauthorized != null && meta.inquiries_flagged_unauthorized > 0 && (
                  <> · <strong>{meta.inquiries_flagged_unauthorized}</strong> unauthorized inquiry(ies)</>
                )}
              </p>
            )}
            {result.opening_summary && (
              <div>
                <h4 className="text-sm font-medium mb-1">Summary</h4>
                <p className="text-sm text-muted-foreground">{result.opening_summary}</p>
              </div>
            )}
            {result.supporting_bullets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">Supporting points</h4>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {result.supporting_bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <h4 className="text-sm font-medium">Draft letter</h4>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={copyLetter}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                  <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1" />
                    )}
                    Save to client
                  </Button>
                </div>
              </div>
              <Textarea
                className="min-h-[280px] font-mono text-sm"
                value={editedLetter}
                onChange={(e) => setEditedLetter(e.target.value)}
              />
            </div>
            {result.operator_checklist.length > 0 && (
              <Alert>
                <AlertTitle>Checklist before sending</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                    {result.operator_checklist.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
