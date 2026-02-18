/**
 * Chronological View Component
 * 
 * Flat timeline view sorted by event_date (oldest first, nulls at bottom).
 */

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { TimelineEvent } from '@/types/operator';
import { EvidenceItem } from './EvidenceItem';

interface ChronologicalViewProps {
  events: TimelineEvent[];
  clientId: string;
  showDebug?: boolean;
  onEdit?: (event: TimelineEvent) => void;
}

export function ChronologicalView({ events, clientId, showDebug = false, onEdit }: ChronologicalViewProps) {
  // Sort and group by date
  const groupedEvents = useMemo(() => {
    // Sort events: known dates oldest→newest, null dates at bottom
    const sorted = [...events].sort((a, b) => {
      const aHasDate = !!a.event_date && !a.date_is_unknown;
      const bHasDate = !!b.event_date && !b.date_is_unknown;

      if (!aHasDate && !bHasDate) return 0;
      if (!aHasDate) return 1;
      if (!bHasDate) return -1;
      return new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime();
    });
    
    // Group by date
    const groups: Record<string, TimelineEvent[]> = {};
    sorted.forEach(event => {
      const date = !event.event_date || event.date_is_unknown ? 'unknown' : event.event_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    });
    
    return groups;
  }, [events]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedEvents).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }, [groupedEvents]);

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No evidence logged yet. Paste a ChatGPT update to import actions, responses, and outcomes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map(date => (
        <div key={date}>
          <div className="text-xs font-medium text-muted-foreground mb-3 sticky top-0 bg-card py-1">
            {date === 'unknown' ? 'Date unknown' : format(parseISO(date), 'EEEE, MMMM d, yyyy')}
          </div>
          <div className="space-y-4">
            {groupedEvents[date].map(event => (
              <EvidenceItem 
                key={event.id} 
                event={event} 
                clientId={clientId}
                showDebug={showDebug}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
