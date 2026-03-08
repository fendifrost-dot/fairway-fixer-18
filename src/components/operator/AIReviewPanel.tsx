/**
 * AIReviewPanel — Shows AI-suggested timeline events for operator review.
 *
 * AI output is NEVER committed directly. The operator must approve each suggestion.
 * raw_line comes from the ORIGINAL input, never from AI output.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Check, X, Loader2, Brain, CalendarIcon, AlertTriangle, Eye, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBulkCreateTimelineEvents } from '@/hooks/useTimelineEvents';
import { getAllSources } from '@/lib/smartImport';
import { EventSource, EventCategory } from '@/types/operator';

export interface AISuggestion {
  line_index: number;
  event_kind: 'action' | 'response' | 'outcome';
  category: EventCategory;
  source: string;
  event_date: string | null;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  // Preserved from original input (not AI)
  original_line: string;
}

interface AIReviewPanelProps {
  suggestions: AISuggestion[];
  clientId: string;
  /** Full array of unrouted lines sent to AI — used to show surrounding context */
  allUnroutedLines?: string[];
  onDone: () => void;
}

const VALID_SOURCES = new Set(getAllSources());

const confidenceColor: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function AIReviewPanel({ suggestions, clientId, allUnroutedLines, onDone }: AIReviewPanelProps) {
  const [items, setItems] = useState<(AISuggestion & { accepted: boolean | null })[]>(
    suggestions.map((s) => ({ ...s, accepted: null }))
  );
  const createEvents = useBulkCreateTimelineEvents();
  const isCommitting = createEvents.isPending;

  const updateItem = (index: number, updates: Partial<AISuggestion>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const acceptItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, accepted: true } : item))
    );
  };

  const rejectItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, accepted: false } : item))
    );
  };

  const acceptedItems = items.filter((i) => i.accepted === true);
  const pendingItems = items.filter((i) => i.accepted === null);

  const handleCommit = async () => {
    if (acceptedItems.length === 0) {
      toast.info('No suggestions accepted');
      onDone();
      return;
    }

    const categoryMap: Record<string, EventCategory> = {
      action: 'Action',
      response: 'Response',
      outcome: 'Outcome',
    };

    // Build candidate events
    const allCandidates = acceptedItems.map((item) => ({
      client_id: clientId,
      event_date: item.event_date || null,
      date_is_unknown: !item.event_date,
      category: (categoryMap[item.event_kind] || 'Action') as EventCategory,
      source: (VALID_SOURCES.has(item.source as EventSource) ? item.source : 'Other') as EventSource,
      title: item.event_kind.charAt(0).toUpperCase() + item.event_kind.slice(1),
      summary: item.summary.slice(0, 200),
      details: null,
      related_accounts: null,
      // CRITICAL: raw_line comes from ORIGINAL input, never AI
      raw_line: item.original_line,
      event_kind: item.event_kind,
      is_draft: false,
    }));

    try {
      // DUPLICATE CHECK: fetch existing events for this client, build fingerprint set
      const { data: existing } = await supabase
        .from('timeline_events')
        .select('raw_line, source, event_date, event_kind')
        .eq('client_id', clientId);

      const existingFingerprints = new Set(
        (existing || []).map((e) =>
          `${(e.raw_line || '').trim()}|${e.source || ''}|${e.event_date || ''}|${e.event_kind || ''}`
        )
      );

      // Also deduplicate within the batch itself
      const seenInBatch = new Set<string>();
      const deduped: typeof allCandidates = [];
      let skipped = 0;

      for (const evt of allCandidates) {
        const fp = `${(evt.raw_line || '').trim()}|${evt.source || ''}|${evt.event_date || ''}|${evt.event_kind || ''}`;
        if (existingFingerprints.has(fp) || seenInBatch.has(fp)) {
          skipped++;
        } else {
          seenInBatch.add(fp);
          deduped.push(evt);
        }
      }

      if (deduped.length === 0) {
        toast.info(`All ${skipped} suggestions were duplicates — nothing inserted`);
        onDone();
        return;
      }

      await createEvents.mutateAsync(deduped);

      if (skipped > 0) {
        toast.success(`${deduped.length} events committed, ${skipped} duplicates skipped`);
      } else {
        toast.success(`${deduped.length} AI-suggested events committed`);
      }
      onDone();
    } catch (e) {
      toast.error('Failed to commit: ' + (e as Error).message);
    }
  };

  return (
    <Card className="border-accent/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          AI Suggestions — Review Required
          <Badge variant="secondary" className="text-xs">
            {pendingItems.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            AI output is never committed automatically. Review each suggestion, edit if needed, then approve or reject.
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground">Change all sources:</span>
            <Select
              onValueChange={(v) => {
                setItems((prev) =>
                  prev.map((item) =>
                    item.accepted !== true ? { ...item, source: v } : item
                  )
                );
                toast.success(`All pending suggestions updated to ${v}`);
              }}
            >
              <SelectTrigger className="w-[140px] h-7 text-xs">
                <SelectValue placeholder="Bulk change…" />
              </SelectTrigger>
              <SelectContent>
                {getAllSources().map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {items.map((item, idx) => {
          if (item.accepted === false) return null; // hide rejected

          return (
            <div
              key={idx}
              className={`p-3 rounded-md border text-sm space-y-2 ${
                item.accepted === true
                  ? 'border-green-300 bg-green-50 dark:bg-green-950/20'
                  : 'border-border bg-muted/30'
              }`}
            >
              {/* Header: confidence + source + kind */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs ${confidenceColor[item.confidence]}`}>
                  {item.confidence}
                </Badge>

                <Select
                  value={item.source}
                  onValueChange={(v) => updateItem(idx, { source: v })}
                >
                  <SelectTrigger className="w-[130px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAllSources().map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={item.event_kind}
                  onValueChange={(v) =>
                    updateItem(idx, {
                      event_kind: v as 'action' | 'response' | 'outcome',
                      category: ({ action: 'Action', response: 'Response', outcome: 'Outcome' } as Record<string, EventCategory>)[v],
                    })
                  }
                  disabled={item.accepted === true}
                >
                  <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action">action</SelectItem>
                    <SelectItem value="response">response</SelectItem>
                    <SelectItem value="outcome">outcome</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={item.accepted === true}
                    >
                      <CalendarIcon className="h-3 w-3" />
                      {item.event_date || 'No date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        item.event_date
                          ? parse(item.event_date, 'yyyy-MM-dd', new Date())
                          : undefined
                      }
                      onSelect={(date) =>
                        updateItem(idx, {
                          event_date: date ? format(date, 'yyyy-MM-dd') : null,
                        })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Summary (editable) */}
              <Input
                value={item.summary}
                onChange={(e) => updateItem(idx, { summary: e.target.value })}
                className="h-7 text-xs"
                disabled={item.accepted === true}
              />

              {/* Original line (read-only, forensic) */}
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground font-mono truncate flex-1" title={item.original_line}>
                  raw: {item.original_line || '(empty)'}
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs gap-1 text-muted-foreground shrink-0">
                      <Eye className="h-3 w-3" /> View full raw line
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-sm">Original Raw Line</DialogTitle>
                      <DialogDescription className="text-xs">
                        Preserved exactly as entered. Read-only.
                      </DialogDescription>
                    </DialogHeader>
                    {item.original_line ? (
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(item.original_line);
                              toast.success('Raw line copied');
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted p-3 rounded-md border max-h-64 overflow-auto select-text">
                          {item.original_line}
                        </pre>

                        {/* Show surrounding context so operator can verify AI's bureau inference */}
                        {allUnroutedLines && allUnroutedLines.length > 1 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Full context sent to AI ({allUnroutedLines.length} lines):
                            </p>
                            <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/50 p-3 rounded-md border max-h-48 overflow-auto select-text">
                              {allUnroutedLines.map((line, li) => {
                                const isCurrentLine = li === item.line_index - 1;
                                return isCurrentLine
                                  ? `► ${li + 1}. ${line}`
                                  : `  ${li + 1}. ${line}`;
                              }).join('\n')}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No raw line available for this suggestion.</p>
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              {/* Actions */}
              {item.accepted === null && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs text-green-700"
                    onClick={() => acceptItem(idx)}
                  >
                    <Check className="h-3 w-3 mr-1" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs text-destructive"
                    onClick={() => rejectItem(idx)}
                  >
                    <X className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Commit controls */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={handleCommit}
            disabled={isCommitting || acceptedItems.length === 0}
          >
            {isCommitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            Commit {acceptedItems.length} accepted
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDone}
            disabled={isCommitting}
          >
            Dismiss all
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {items.filter((i) => i.accepted === false).length} rejected
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
