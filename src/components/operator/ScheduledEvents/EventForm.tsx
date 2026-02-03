import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Link2, X } from 'lucide-react';
import { TimelineEvent, SOURCE_DISPLAY_NAMES } from '@/types/operator';
import { EventFormData, RECURRENCE_OPTIONS } from './types';
import { format, parseISO } from 'date-fns';

interface EventFormProps {
  onSubmit: (data: EventFormData) => void;
  isLoading: boolean;
  timelineEvents?: TimelineEvent[];
}

export function EventForm({ onSubmit, isLoading, timelineEvents = [] }: EventFormProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [notes, setNotes] = useState('');
  const [linkedEventIds, setLinkedEventIds] = useState<string[]>([]);
  const [recurrenceRule, setRecurrenceRule] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    if (!title.trim() || !dueDate) return;
    
    onSubmit({
      title: title.trim(),
      dueDate,
      dueTime: dueTime || '',
      notes: notes.trim(),
      linkedEventIds,
      recurrenceRule: recurrenceRule || null,
    });

    // Reset form
    setTitle('');
    setDueDate('');
    setDueTime('');
    setNotes('');
    setLinkedEventIds([]);
    setRecurrenceRule('');
    setShowAdvanced(false);
  };

  const toggleLinkedEvent = (eventId: string) => {
    setLinkedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  // Filter timeline events to show only recent actions (last 60 days)
  const recentEvents = timelineEvents
    .filter(e => !e.is_draft && e.category === 'Action')
    .slice(0, 20);

  return (
    <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
      <Input
        placeholder="Event title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm"
      />
      
      <div className="flex gap-2">
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8 text-sm flex-1"
        />
        <Input
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
          className="h-8 text-sm w-28"
          placeholder="HH:MM"
        />
      </div>

      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 text-xs w-full justify-between">
            <span>Advanced options</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Notes */}
          <Textarea
            placeholder="Notes (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px] text-sm"
          />

          {/* Recurrence */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Recurrence</label>
            <Select value={recurrenceRule} onValueChange={setRecurrenceRule}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="No recurrence" />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value || 'none'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Link to Evidence */}
          {recentEvents.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Link to Evidence
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2 bg-background">
                {recentEvents.map(event => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => toggleLinkedEvent(event.id)}
                    className={`w-full text-left p-1.5 rounded text-xs transition-colors ${
                      linkedEventIds.includes(event.id) 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {linkedEventIds.includes(event.id) && (
                        <X className="h-3 w-3 text-primary shrink-0" />
                      )}
                      <span className="truncate flex-1">{event.title}</span>
                      {event.source && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {SOURCE_DISPLAY_NAMES[event.source]}
                        </Badge>
                      )}
                    </div>
                    {event.event_date && (
                      <span className="text-muted-foreground text-[10px]">
                        {format(parseISO(event.event_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {linkedEventIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {linkedEventIds.length} event(s) linked
                </p>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Button 
        size="sm" 
        onClick={handleSubmit}
        disabled={!title.trim() || !dueDate || isLoading}
        className="w-full h-8"
      >
        Create Event
      </Button>
    </div>
  );
}
