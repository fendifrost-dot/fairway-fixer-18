import { TimelineEvent, EventCategory, EventSource, CRA_SOURCES, DATA_BROKER_SOURCES, REGULATORY_SOURCES } from '@/types/operator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { ChevronDown, MessageSquare, CheckCircle2, FileText, Trash2, Building2, Shield, Database, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useDeleteTimelineEvent } from '@/hooks/useTimelineEvents';

interface EvidenceTimelineProps {
  events: TimelineEvent[];
  clientId: string;
}

// Only Action, Response, Outcome are allowed in evidence timeline
type EvidenceCategory = 'Action' | 'Response' | 'Outcome';

const categoryConfig: Record<EvidenceCategory, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; label: string }> = {
  Action: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' },
  Response: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Response' },
  Outcome: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Outcome' },
};

// Source grouping configuration
const sourceGroups: { label: string; sources: EventSource[]; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Credit Bureaus', sources: CRA_SOURCES, icon: Building2 },
  { label: 'Data Brokers', sources: DATA_BROKER_SOURCES, icon: Database },
  { label: 'Regulatory', sources: REGULATORY_SOURCES, icon: Shield },
];

function EvidenceItem({ event, clientId }: { event: TimelineEvent; clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const deleteEvent = useDeleteTimelineEvent();
  const config = categoryConfig[event.category as EvidenceCategory];
  
  if (!config) return null; // Safety check
  
  const Icon = config.icon;
  const hasExpandableContent = event.details || (event.related_accounts && event.related_accounts.length > 0);
  
  return (
    <div className="flex gap-3 group">
      <div className={`flex-shrink-0 w-7 h-7 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {event.event_date ? format(parseISO(event.event_date), 'MMM d, yyyy') : 'Date Unknown'}
                </span>
              </div>
              <p className="font-medium mt-1 text-sm">{event.title}</p>
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

function SourceSection({ source, events, clientId, displayName }: { source: EventSource; events: TimelineEvent[]; clientId: string; displayName?: string }) {
  const stats = useMemo(() => {
    return {
      actions: events.filter(e => e.category === 'Action').length,
      responses: events.filter(e => e.category === 'Response').length,
      outcomes: events.filter(e => e.category === 'Outcome').length,
    };
  }, [events]);

  const label = displayName || source;

  return (
    <AccordionItem value={label} className="border rounded-lg mb-2 px-3">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{label}</span>
            <Badge variant="secondary" className="text-xs">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {stats.actions > 0 && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-200">
                {stats.actions} action{stats.actions !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.responses > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                {stats.responses} response{stats.responses !== 1 ? 's' : ''}
              </Badge>
            )}
            {stats.outcomes > 0 && (
              <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200">
                {stats.outcomes} outcome{stats.outcomes !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <div className="space-y-3 pt-2">
          {events.map(event => (
            <EvidenceItem key={event.id} event={event} clientId={clientId} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function ChronologicalView({ events, clientId }: { events: TimelineEvent[]; clientId: string }) {
  const groupedEvents = events.reduce((acc, event) => {
    const date = event.event_date || 'unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);
  
  const sortedDates = Object.keys(groupedEvents).sort((a, b) => {
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div className="space-y-6">
      {sortedDates.map(date => (
        <div key={date}>
          <div className="text-xs font-medium text-muted-foreground mb-3 sticky top-0 bg-card py-1">
            {date === 'unknown' ? 'Date Unknown' : format(parseISO(date), 'EEEE, MMMM d, yyyy')}
          </div>
          <div className="space-y-4">
            {groupedEvents[date].map(event => (
              <EvidenceItem key={event.id} event={event} clientId={clientId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EvidenceTimeline({ events, clientId }: EvidenceTimelineProps) {
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Filter to only evidence events (exclude Notes)
  const evidenceEvents = useMemo(() => {
    return events.filter(e => e.category !== 'Note');
  }, [events]);

  // Group events by source
  const eventsBySource = useMemo(() => {
    const grouped: Record<string, TimelineEvent[]> = {};
    
    evidenceEvents.forEach(event => {
      const source = event.source || 'Other';
      if (!grouped[source]) grouped[source] = [];
      grouped[source].push(event);
    });

    // Sort events within each source by event_date (oldest first)
    Object.keys(grouped).forEach(source => {
      grouped[source].sort((a, b) => {
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      });
    });

    return grouped;
  }, [evidenceEvents]);

  // Get sources that have events, organized by group
  const activeSourcesByGroup = useMemo(() => {
    const result: { group: string; icon: React.ComponentType<{ className?: string }>; sources: (EventSource | 'Unassigned')[] }[] = [];
    
    sourceGroups.forEach(group => {
      const activeSources = group.sources.filter(source => eventsBySource[source]?.length > 0);
      if (activeSources.length > 0) {
        result.push({ group: group.label, icon: group.icon, sources: activeSources });
      }
    });

    // Add "Other" if present (includes null sources)
    if (eventsBySource['Other']?.length > 0) {
      result.push({ group: 'Unassigned Source', icon: AlertCircle, sources: ['Unassigned' as EventSource] });
    }

    return result;
  }, [eventsBySource]);

  if (evidenceEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No evidence logged yet. Paste a ChatGPT update to import actions, responses, and outcomes.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence Timeline ({evidenceEvents.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="view-toggle" className="text-xs text-muted-foreground">
              {showAllEvents ? 'Chronological' : 'By Source'}
            </Label>
            <Switch
              id="view-toggle"
              checked={showAllEvents}
              onCheckedChange={setShowAllEvents}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showAllEvents ? (
          <ChronologicalView events={evidenceEvents} clientId={clientId} />
        ) : (
          <div className="space-y-4">
            {activeSourcesByGroup.map(({ group, icon: GroupIcon, sources }) => (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <GroupIcon className="h-4 w-4" />
                  <span>{group}</span>
                </div>
                <Accordion type="multiple" className="w-full">
                  {sources.map(source => (
                    <SourceSection
                      key={source}
                      source={source === 'Unassigned' ? 'Other' : source}
                      events={source === 'Unassigned' ? eventsBySource['Other'] || [] : eventsBySource[source] || []}
                      clientId={clientId}
                      displayName={source === 'Unassigned' ? 'Unassigned' : undefined}
                    />
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
