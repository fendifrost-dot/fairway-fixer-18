import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { StickyNote, Trash2, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { useNotes } from '@/hooks/useNotes';
import { useDeleteTimelineEvent } from '@/hooks/useTimelineEvents';
import { TimelineEvent } from '@/types/operator';

interface NotesSectionProps {
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
                {!event.event_date || event.date_is_unknown
                  ? 'Date unknown'
                  : format(parseISO(event.event_date), 'MMM d, yyyy')}
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

/**
 * Notes & Flags Section
 * 
 * STRICT ISOLATION RULES (non-negotiable):
 * - Uses dedicated useNotes hook with strict filtering
 * - Shows ONLY true notes (event_kind NOT in action/response/outcome/draft)
 * - NEVER shows items from Evidence Timeline or Drafts
 * - If no true notes exist, section is hidden
 */
export function NotesSection({ clientId }: NotesSectionProps) {
  const { data: noteEvents = [], isLoading } = useNotes(clientId);

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

  // Don't show section if no notes or loading
  if (isLoading || noteEvents.length === 0) {
    return null;
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
