/**
 * Add Entry Dialog
 * Manual creation of a single timeline event with stable predictable form fields.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pastDateBounds } from '@/lib/dateBounds';
import { useCreateTimelineEvent } from '@/hooks/useTimelineEvents';
import { ALL_SOURCES, SOURCE_DISPLAY_NAMES, EVENT_CATEGORIES, EventSource, EventCategory } from '@/types/operator';

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

export function AddEntryDialog({ open, onOpenChange, clientId }: AddEntryDialogProps) {
  const createEvent = useCreateTimelineEvent();
  
  // yyyy-MM-dd string ('' = no date). Native <input type="date"> value shape.
  const [eventDate, setEventDate] = useState<string>('');
  const [category, setCategory] = useState<EventCategory>('Action');
  const [eventKind, setEventKind] = useState<string>('action');
  const [source, setSource] = useState<string>('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [rawLine, setRawLine] = useState('');

  const categoryToKind: Record<EventCategory, string> = {
    Action: 'action',
    Response: 'response',
    Outcome: 'outcome',
    Note: 'note',
  };

  const handleCategoryChange = (val: EventCategory) => {
    setCategory(val);
    setEventKind(categoryToKind[val]);
  };

  const resetForm = () => {
    setEventDate('');
    setCategory('Action');
    setEventKind('action');
    setSource('');
    setTitle('');
    setSummary('');
    setDetails('');
    setRawLine('');
  };

  const handleSubmit = () => {
    const dateStr = eventDate || null;
    const effectiveRawLine = rawLine.trim() || summary.trim() || title.trim();
    
    if (!effectiveRawLine) return;

    createEvent.mutate({
      client_id: clientId,
      event_date: dateStr,
      date_is_unknown: !dateStr,
      category: category,
      source: (source || null) as EventSource | null,
      title: title || category,
      summary: summary || title,
      details: details || null,
      related_accounts: null,
      raw_line: effectiveRawLine,
      event_kind: eventKind,
      is_draft: false,
    }, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      },
    });
  };

  const canSubmit = (title.trim() || summary.trim()) && !createEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Timeline Entry</DialogTitle>
          <DialogDescription>Manually add an evidence event to the timeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Action Date */}
          <div className="space-y-1">
            <Label htmlFor="add-event-date">Action Date</Label>
            <Input
              id="add-event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              {...pastDateBounds()}
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label htmlFor="add-category">Category</Label>
            <Select value={category} onValueChange={(v) => handleCategoryChange(v as EventCategory)}>
              <SelectTrigger id="add-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.filter(c => c !== 'Note').map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-1">
            <Label htmlFor="add-source">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="add-source"><SelectValue placeholder="Select source..." /></SelectTrigger>
              <SelectContent>
                {ALL_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{SOURCE_DISPLAY_NAMES[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="add-title">Title</Label>
            <Input id="add-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dispute Letter Sent" />
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <Label htmlFor="add-summary">Summary</Label>
            <Textarea id="add-summary" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>

          {/* Details */}
          <div className="space-y-1">
            <Label htmlFor="add-details">Details (optional)</Label>
            <Textarea id="add-details" value={details} onChange={e => setDetails(e.target.value)} placeholder="Additional context..." rows={2} />
          </div>

          {/* Raw Line */}
          <div className="space-y-1">
            <Label htmlFor="add-rawline">Raw Evidence Text</Label>
            <Textarea id="add-rawline" value={rawLine} onChange={e => setRawLine(e.target.value)} placeholder="Verbatim source text (auto-filled from summary if empty)" rows={3} className="font-mono text-xs" />
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-background border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createEvent.isPending ? 'Adding...' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
