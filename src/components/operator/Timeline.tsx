import { TimelineEvent, EventCategory } from '@/types/operator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO } from 'date-fns';
import { ChevronDown, Clock, MessageSquare, CheckCircle2, FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDeleteTimelineEvent } from '@/hooks/useTimelineEvents';

interface TimelineProps {
  events: TimelineEvent[];
  clientId: string;
}

const categoryConfig: Record<EventCategory, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  Action: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  Response: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  Outcome: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  Note: { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

function TimelineItem({ event, clientId }: { event: TimelineEvent; clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const deleteEvent = useDeleteTimelineEvent();
  const config = categoryConfig[event.category];
  const Icon = config.icon;
  
  const hasExpandableContent = event.details || (event.related_accounts && event.related_accounts.length > 0);
  
  return (
    <div className="flex gap-3 group">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {event.category}
                </Badge>
                {event.source && (
                  <Badge variant="secondary" className="text-xs">
                    {event.source}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {event.event_date ? format(parseISO(event.event_date), 'MMM d, yyyy') : 'Date Unknown'}
                </span>
              </div>
              <p className="font-medium mt-1">{event.title}</p>
              <p className="text-sm text-muted-foreground">{event.summary}</p>
            </div>
            
            <div className="flex items-center gap-1">
              {hasExpandableContent && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              )}
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
          
          {hasExpandableContent && (
            <CollapsibleContent className="mt-2 pl-2 border-l-2 border-muted">
              {event.details && (
                <p className="text-sm text-muted-foreground">{event.details}</p>
              )}
              {event.related_accounts && event.related_accounts.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Related Accounts:</p>
                  <div className="flex flex-wrap gap-1">
                    {event.related_accounts.map((acc, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {acc.name}{acc.masked_number ? ` (${acc.masked_number})` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    </div>
  );
}

export function Timeline({ events, clientId }: TimelineProps) {
  // Group events by event_date (use "unknown" for null dates)
  const groupedEvents = events.reduce((acc, event) => {
    const date = event.event_date || 'unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);
  
  // Sort dates oldest first, with "unknown" last
  const sortedDates = Object.keys(groupedEvents).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });
  
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No events yet. Paste a ChatGPT update above to get started.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline ({events.length} events)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedDates.map(date => (
          <div key={date}>
            <div className="text-xs font-medium text-muted-foreground mb-3 sticky top-0 bg-card">
              {date === 'unknown' ? 'Date Unknown' : format(parseISO(date), 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="space-y-4">
              {groupedEvents[date].map(event => (
                <TimelineItem key={event.id} event={event} clientId={clientId} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
