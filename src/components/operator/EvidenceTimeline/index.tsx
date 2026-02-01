/**
 * Evidence Timeline Component
 * 
 * Fixed accordion structure with drag-and-drop source corrections.
 * 
 * Contract:
 * - 11 fixed sources ALWAYS rendered in 3 groups
 * - Sorted by event_date (oldest first, nulls at bottom)
 * - Drag-and-drop for source correction with audit trail
 * - Debug placement line per event
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Accordion } from '@/components/ui/accordion';
import { FileText, Building2, Database, Shield, Bug } from 'lucide-react';
import { TimelineEvent, EventSource, SOURCE_ACCORDION_STRUCTURE } from '@/types/operator';
import { useCreateSourceCorrection } from '@/hooks/useSourceCorrections';
import { EvidenceTimelineProps } from './types';
import { SourceSection } from './SourceSection';
import { ChronologicalView } from './ChronologicalView';

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Credit Bureaus': Building2,
  'Data Brokers': Database,
  'Regulatory': Shield,
};

export function EvidenceTimeline({ events, clientId }: EvidenceTimelineProps) {
  const [showChronological, setShowChronological] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const createCorrection = useCreateSourceCorrection();

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

    return grouped;
  }, [evidenceEvents]);

  // Handle drop for source correction
  const handleDrop = (event: TimelineEvent, toSource: EventSource) => {
    const fromSource = event.source || 'Other';
    if (fromSource === toSource) return;
    
    createCorrection.mutate({
      eventId: event.id,
      fromSource,
      toSource,
      clientId,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence Timeline ({evidenceEvents.length})
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Debug toggle */}
            <div className="flex items-center gap-2">
              <Bug className="h-3 w-3 text-muted-foreground" />
              <Switch
                id="debug-toggle"
                checked={showDebug}
                onCheckedChange={setShowDebug}
                className="scale-75"
              />
            </div>
            {/* View toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="view-toggle" className="text-xs text-muted-foreground">
                {showChronological ? 'Chronological' : 'By Source'}
              </Label>
              <Switch
                id="view-toggle"
                checked={showChronological}
                onCheckedChange={setShowChronological}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showChronological ? (
          <ChronologicalView 
            events={evidenceEvents} 
            clientId={clientId}
            showDebug={showDebug}
          />
        ) : (
          <div className="space-y-4">
            {SOURCE_ACCORDION_STRUCTURE.map(({ group, sources }) => {
              const GroupIcon = GROUP_ICONS[group] || Building2;
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                    <GroupIcon className="h-4 w-4" />
                    <span>{group}</span>
                  </div>
                  <Accordion type="multiple" className="w-full">
                    {sources.map(source => (
                      <SourceSection
                        key={source}
                        source={source}
                        events={eventsBySource[source] || []}
                        clientId={clientId}
                        showDebug={showDebug}
                        onDrop={handleDrop}
                      />
                    ))}
                  </Accordion>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Re-export for backwards compatibility
export { EvidenceTimeline as default };
