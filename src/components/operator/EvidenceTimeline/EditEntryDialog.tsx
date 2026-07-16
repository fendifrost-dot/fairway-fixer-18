/**
 * Edit Entry Dialog
 * Edit existing timeline event fields.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pastDateBounds } from '@/lib/dateBounds';
import { useUpdateTimelineEvent } from '@/hooks/useTimelineEvents';
import { TimelineEvent, ALL_SOURCES, SOURCE_DISPLAY_NAMES, EVENT_CATEGORIES, EventSource, EventCategory } from '@/types/operator';

interface EditEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEvent | null;
  clientId: string;
}

export function EditEntryDialog({ open, onOpenChange, event, clientId }: EditEntryDialogProps) {
  const updateEvent = useUpdateTimelineEvent();
  
  // yyyy-MM-dd string ('' = no date). Native <input type="date"> value shape.
  const [eventDate, setEventDate] = useState<string>('');
  const [category, setCategory] = useState<EventCategory>('Action');
  const [eventKind, setEventKind] = useState<string>('action');
  const [source, setSource] = useState<string>('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');

  const categoryToKind: Record<EventCategory, string> = {
    Action: 'action',
    Response: 'response',
    Outcome: 'outcome',
    Note: 'note',
  };

  useEffect(() => {
    if (event) {
      setEventDate(event.event_date && !event.date_is_unknown ? event.event_date.slice(0, 10) : '');
      setCategory(event.category);
      setEventKind(event.event_kind || categoryToKind[event.category]);
      setSource(event.source || '');
      setTitle(event.title);
      setSummary(event.summary);
      setDetails(event.details || '');
    }
  }, [event]);

  const handleCategoryChange = (val: EventCategory) => {
    setCategory(val);
    setEventKind(categoryToKind[val]);
  };

  const handleSubmit = () => {
    if (!event) return;
    const dateStr = eventDate || null;

    updateEvent.mutate({
      id: event.id,
      clientId,
      updates: {
        event_date: dateStr,
        date_is_unknown: !dateStr,
        category: category,
        source: (source || null) as EventSource | null,
        title,
        summary,
        details: details || null,
        event_kind: eventKind,
      },
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const canSubmit = (title.trim() || summary.trim()) && !updateEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Timeline Entry</DialogTitle>
          <DialogDescription>Modify the event fields below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Action Date */}
          <div className="space-y-1">
            <Label htmlFor="edit-event-date">Action Date</Label>
            <Input
              id="edit-event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              {...pastDateBounds()}
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={(v) => handleCategoryChange(v as EventCategory)}>
              <SelectTrigger id="edit-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.filter(c => c !== 'Note').map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-1">
            <Label htmlFor="edit-source">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="edit-source"><SelectValue placeholder="Select source..." /></SelectTrigger>
              <SelectContent>
                {ALL_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{SOURCE_DISPLAY_NAMES[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <Label htmlFor="edit-summary">Summary</Label>
            <Textarea id="edit-summary" value={summary} onChange={e => setSummary(e.target.value)} rows={2} />
          </div>

          {/* Details */}
          <div className="space-y-1">
            <Label htmlFor="edit-details">Details</Label>
            <Textarea id="edit-details" value={details} onChange={e => setDetails(e.target.value)} rows={2} />
          </div>

          {/* Read-only raw_line */}
          {event?.raw_line && (
            <div className="space-y-1">
              <Label>Raw Evidence Text (read-only)</Label>
              <pre className="text-xs font-mono bg-muted p-2 rounded whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {event.raw_line}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-background border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {updateEvent.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
