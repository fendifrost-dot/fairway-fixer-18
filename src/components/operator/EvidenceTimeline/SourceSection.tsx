/**
 * Source Section Component
 * 
 * Collapsible accordion section for a single source.
 * Accepts drops for source correction.
 */

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TimelineEvent, EventSource, SOURCE_DISPLAY_NAMES } from '@/types/operator';
import { SourceSectionProps } from './types';
import { EvidenceItem } from './EvidenceItem';

export function SourceSection({ 
  source, 
  events, 
  clientId, 
  showDebug = false,
  isDropTarget = false,
  onDrop 
}: SourceSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Sort events: known dates oldest→newest, null dates at bottom
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aHasDate = !!a.event_date && !a.date_is_unknown;
      const bHasDate = !!b.event_date && !b.date_is_unknown;

      // Unknown dates go to bottom
      if (!aHasDate && !bHasDate) return 0;
      if (!aHasDate) return 1;
      if (!bHasDate) return -1;
      // Sort by event_date ascending (oldest first)
      return new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime();
    });
  }, [events]);

  const stats = useMemo(() => ({
    actions: events.filter(e => e.category === 'Action').length,
    responses: events.filter(e => e.category === 'Response').length,
    outcomes: events.filter(e => e.category === 'Outcome').length,
    notes: events.filter(e => e.category === 'Note').length,
  }), [events]);

  const displayName = SOURCE_DISPLAY_NAMES[source] || source;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const eventData = JSON.parse(e.dataTransfer.getData('application/json')) as TimelineEvent;
      // Only trigger drop if source is different
      if (eventData.source !== source) {
        onDrop?.(eventData, source);
      }
    } catch {
      // Invalid drag data
    }
  };

  return (
    <AccordionItem 
      value={source} 
      className={`border rounded-lg mb-2 px-3 transition-colors ${
        isDragOver ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName}</span>
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
            No evidence for {displayName} yet
          </p>
        ) : (
          <div className="space-y-3 pt-2">
            {sortedEvents.map(event => (
              <EvidenceItem 
                key={event.id} 
                event={event} 
                clientId={clientId}
                showDebug={showDebug}
              />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
