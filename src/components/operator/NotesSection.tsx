import { TimelineEvent } from '@/types/operator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { StickyNote, Trash2, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { useDeleteTimelineEvent } from '@/hooks/useTimelineEvents';

interface NotesSectionProps {
  events: TimelineEvent[];
  clientId: string;
}

function NoteItem({ event, clientId }: { event: TimelineEvent; clientId: string }) {
  const deleteEvent = useDeleteTimelineEvent();
  
  // Check if this looks like a flag/warning vs regular note
  const isFlag = useMemo(() => {
    const lowerSummary = event.summary.toLowerCase();
    return lowerSummary.includes('missing') || 
           lowerSummary.includes('redacted') || 
           lowerSummary.includes('unknown') ||
           lowerSummary.includes('not stated') ||
           lowerSummary.includes('not provided') ||
           lowerSummary.includes('unclear');
  }, [event.summary]);
  
  return (
    <div className="flex gap-3 group py-2 border-b last:border-b-0">
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isFlag ? 'bg-amber-100' : 'bg-gray-100'}`}>
        {isFlag ? (
          <AlertTriangle className="h-3 w-3 text-amber-600" />
        ) : (
          <StickyNote className="h-3 w-3 text-gray-600" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">
                {event.event_date ? format(parseISO(event.event_date), 'MMM d, yyyy') : 'No date'}
              </span>
              {event.source && (
                <Badge variant="outline" className="text-xs">
                  {event.source}
                </Badge>
              )}
              {isFlag && (
                <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                  Flag
                </Badge>
              )}
            </div>
            <p className="text-sm">{event.summary}</p>
            {event.details && (
              <p className="text-xs text-muted-foreground mt-1">{event.details}</p>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={() => deleteEvent.mutate({ id: event.id, clientId })}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotesSection({ events, clientId }: NotesSectionProps) {
  // Filter to only Note events
  const noteEvents = useMemo(() => {
    return events
      .filter(e => e.category === 'Note')
      .sort((a, b) => {
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        return new Date(b.event_date).getTime() - new Date(a.event_date).getTime(); // newest first
      });
  }, [events]);

  const flagCount = useMemo(() => {
    return noteEvents.filter(e => {
      const lowerSummary = e.summary.toLowerCase();
      return lowerSummary.includes('missing') || 
             lowerSummary.includes('redacted') || 
             lowerSummary.includes('unknown') ||
             lowerSummary.includes('not stated') ||
             lowerSummary.includes('not provided') ||
             lowerSummary.includes('unclear');
    }).length;
  }, [noteEvents]);

  if (noteEvents.length === 0) {
    return null; // Don't show section if no notes
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Notes & Flags
            <Badge variant="secondary" className="text-xs">
              {noteEvents.length}
            </Badge>
          </CardTitle>
          {flagCount > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
              {flagCount} flag{flagCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y-0">
          {noteEvents.map(event => (
            <NoteItem key={event.id} event={event} clientId={clientId} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
