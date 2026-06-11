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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCreateTimelineEvent } from '@/hooks/useTimelineEvents';
import { ALL_SOURCES, SOURCE_DISPLAY_NAMES, EVENT_CATEGORIES, EventSource, EventCategory } from '@/types/operator';

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

export function AddEntryDialog({ open, onOpenChange, clientId }: AddEntryDialogProps) {
  const createEvent = useCreateTimelineEvent();
  
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
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
    setEventDate(undefined);
    setCategory('Action');
    setEventKind('action');
    setSource('');
    setTitle('');
    setSummary('');
    setDetails('');
    setRawLine('');
  };

  const handleSubmit = () => {
    const dateStr = eventDate ? format(eventDate, 'yyyy-MM-dd') : null;
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="add-event-date"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, 'PPP') : 'Pick a date (optional)'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createEvent.isPending ? 'Adding...' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
