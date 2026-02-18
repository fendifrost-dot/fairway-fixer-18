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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
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
  
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
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
      setEventDate(event.event_date && !event.date_is_unknown ? parseISO(event.event_date) : undefined);
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
    const dateStr = eventDate ? format(eventDate, 'yyyy-MM-dd') : null;

    updateEvent.mutate({
      id: event.id,
      clientId,
      updates: {
        event_date: dateStr,
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="edit-event-date"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, 'PPP') : 'No date set'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {updateEvent.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
