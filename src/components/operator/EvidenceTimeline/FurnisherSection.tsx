/**
 * Furnisher Section (B4)
 *
 * Collapsible accordion section for a single furnisher (creditor / collection
 * agency). Mirrors SourceSection's visuals but identifies events by
 * furnisher_id rather than source.
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TimelineEvent } from '@/types/operator';
import { Furnisher } from '@/types/operator';
import { EvidenceItem } from './EvidenceItem';

interface FurnisherSectionProps {
  furnisher: Furnisher;
  events: TimelineEvent[];
  clientId: string;
  showDebug?: boolean;
  onEdit?: (event: TimelineEvent) => void;
}

export function FurnisherSection({
  furnisher,
  events,
  clientId,
  showDebug,
  onEdit,
}: FurnisherSectionProps) {
  // Sort events: known dates newest→oldest, null dates at bottom (per spec: date desc)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aHas = !!a.event_date && !a.date_is_unknown;
      const bHas = !!b.event_date && !b.date_is_unknown;
      if (!aHas && !bHas) return 0;
      if (!aHas) return 1;
      if (!bHas) return -1;
      return new Date(b.event_date!).getTime() - new Date(a.event_date!).getTime();
    });
  }, [events]);

  const stats = useMemo(() => ({
    actions: events.filter(e => e.category === 'Action').length,
    responses: events.filter(e => e.category === 'Response').length,
    outcomes: events.filter(e => e.category === 'Outcome').length,
    notes: events.filter(e => e.category === 'Note').length,
  }), [events]);

  return (
    <AccordionItem value={furnisher.id} className="border rounded-lg mb-2 px-3">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center justify-between w-full pr-2 gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-medium truncate">{furnisher.name}</span>
            {furnisher.account_last4 && (
              <Badge variant="outline" className="text-xs font-mono">
                …{furnisher.account_last4}
              </Badge>
            )}
            {furnisher.account_type && (
              <Badge variant="secondary" className="text-xs font-normal text-muted-foreground">
                {furnisher.account_type}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
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
            {stats.notes > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200">
                {stats.notes} note{stats.notes !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        {sortedEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No events attached to {furnisher.name} yet
          </p>
        ) : (
          <div className="space-y-3 pt-2">
            {sortedEvents.map(event => (
              <EvidenceItem
                key={event.id}
                event={event}
                clientId={clientId}
                showDebug={showDebug}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
