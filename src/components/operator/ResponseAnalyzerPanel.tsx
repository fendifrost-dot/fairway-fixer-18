/**
 * Response Analyzer — bureau/furnisher reply → operator-reviewed draft letter.
 * Evidence rows are loaded server-side (RLS) by the edge function; only response text is supplied from the client.
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, FileUp, Sparkles, Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEvent, EventSource, ALL_EVIDENCE_SOURCES } from '@/types/operator';
import { maskPII } from '@/lib/piiMasker';
import { extractResponseDocumentText, supportedResponseMimeTypes } from '@/lib/responseDocumentExtract';
import { filterEvidenceForSource, summarizeEvidenceCounts } from '@/lib/bureauResponseFacts';

interface DraftResult {
  draft_letter: string;
  opening_summary: string;
  supporting_bullets: string[];
  operator_checklist: string[];
}

interface ResponseAnalyzerPanelProps {
  clientId: string;
  events: TimelineEvent[];
}

export function ResponseAnalyzerPanel({ clientId, events }: ResponseAnalyzerPanelProps) {
  const [bureau, setBureau] = useState<EventSource>('Experian');
  const [responseText, setResponseText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [composing, setComposing] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [meta, setMeta] = useState<{ evidence_event_count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = filterEvidenceForSource(events, bureau);
  const stats = summarizeEvidenceCounts(filtered);

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
      const { data, error } = await supabase.functions.invoke('analyze-bureau-response', {
        body: {
          client_id: clientId,
          bureau_source: bureau,
          response_document_text: masked,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(String(data.error));
      const r = data?.result as DraftResult | undefined;
      if (!r?.draft_letter) throw new Error('No draft returned');
      setResult(r);
      setMeta(data?.meta ?? null);
      toast.success('Draft generated — review before sending');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setComposing(false);
    }
  };

  const copyLetter = async () => {
    if (!result?.draft_letter) return;
    await navigator.clipboard.writeText(result.draft_letter);
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
          Upload or paste a bureau/furnisher response (PDF, DOCX, image, or text). The tool loads your{' '}
          <strong>existing timeline evidence for the same source</strong> and drafts a follow-up letter for you to
          edit. This is <strong>not legal advice</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Operator review required</AlertTitle>
          <AlertDescription>
            Verify every fact before sending. OCR and PDF text extraction can miss or garble content. Add citations
            and enclosures as your process requires.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Response from (source)</Label>
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
              Evidence timeline on file for this source:{' '}
              <strong>
                {stats.total}
              </strong>{' '}
              events ({stats.actions} actions, {stats.responses} responses, {stats.outcomes} outcomes
              {stats.notes ? `, ${stats.notes} notes` : ''}).
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

        <div className="space-y-2">
          <Label>Bureau response text</Label>
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Paste text here, or extract from a file above…"
            className="min-h-[160px] font-mono text-sm"
          />
        </div>

        <Button type="button" onClick={handleCompose} disabled={composing} className="bg-accent hover:bg-accent/90">
          {composing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate draft letter
        </Button>

        {result && (
          <div className="space-y-4 pt-2 border-t border-border">
            {meta && (
              <p className="text-xs text-muted-foreground">
                Server matched <strong>{meta.evidence_event_count}</strong> evidence row(s) for this source (non-draft
                timeline).
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-sm font-medium">Draft letter</h4>
                <Button type="button" size="sm" variant="outline" onClick={copyLetter}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>
              <Textarea readOnly className="min-h-[280px] font-mono text-sm" value={result.draft_letter} />
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
