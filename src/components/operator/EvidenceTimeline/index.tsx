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

import { useEffect, useMemo, useState } from 'react';
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
import { EvidenceItem } from './EvidenceItem';
import { expandAllCrasEvents, isAllCrasSource, hasAllCrasInContent } from '@/lib/allCrasExpander';
const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Credit Bureaus': Building2,
  'Data Brokers': Database,
  'Regulatory': Shield,
};

export function EvidenceTimeline({ events, clientId }: EvidenceTimelineProps) {
  const [showChronological, setShowChronological] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const createCorrection = useCreateSourceCorrection();

  const sectionSources = useMemo(() => {
    return SOURCE_ACCORDION_STRUCTURE.flatMap(g => [...g.sources]);
  }, []);

  const sectionKeySet = useMemo(() => new Set<EventSource>(sectionSources), [sectionSources]);

  // DEFENSIVE UI LAYER: Expand "All CRAs" events into 3 bureau-specific events
  // This ensures no "All CRAs" appears in UI - each is shown under Experian/TransUnion/Equifax
  const evidenceEvents = useMemo(() => {
    return expandAllCrasEvents(events);
  }, [events]);

  // Group events by source - strict key matching to *accordion section keys*
  // Note: "All CRAs" events have already been expanded above, so they won't appear here
  const { eventsBySource, placementErrors } = useMemo(() => {
    const grouped: Record<string, TimelineEvent[]> = {};
    const errors: TimelineEvent[] = [];

    evidenceEvents.forEach(event => {
      const source = event.source;

      // Placement error cases:
      // 1. Source is null/missing AND doesn't match All CRAs patterns in content
      // 2. Source doesn't match any accordion section key
      // 3. Source explicitly matches "All CRAs" patterns (shouldn't happen after expansion, but defensive)
      const sourceIsAllCras = isAllCrasSource(source);
      const contentIsAllCras = !source && hasAllCrasInContent(event.summary, event.title);
      
      // After expansion, events with All CRAs patterns in content should have a valid source
      // If they don't have a valid source and don't match All CRAs patterns, they're placement errors
      if (!source || !sectionKeySet.has(source as EventSource) || sourceIsAllCras || contentIsAllCras) {
        errors.push(event);
      } else {
        if (!grouped[source]) grouped[source] = [];
        grouped[source].push(event);
      }
    });

    return { eventsBySource: grouped, placementErrors: errors };
  }, [evidenceEvents, sectionKeySet]);

  const debugPanelRows = useMemo(() => {
    const rows = sectionSources.map(source => {
      const list = eventsBySource[source] || [];
      return {
        source,
        count: list.length,
        sampleIds: list.slice(0, 3).map(e => e.id),
      };
    });

    const placementErrorRow = {
      source: 'Placement Error' as const,
      count: placementErrors.length,
      sampleIds: placementErrors.slice(0, 3).map(e => e.id),
    };

    return { rows, placementErrorRow };
  }, [eventsBySource, placementErrors, sectionSources]);

  // Required forensic proof: log counts at each stage
  useEffect(() => {
    if (!showDebug) return;

    const totalFetched = events.length;
    const afterFiltering = evidenceEvents.length;

    const groupedCounts = sectionSources.reduce<Record<string, number>>((acc, source) => {
      acc[source] = (eventsBySource[source] || []).length;
      return acc;
    }, {});

    console.groupCollapsed('[EvidenceTimeline Debug] placement counts');
    console.log('a) total events passed to EvidenceTimeline:', totalFetched);
    console.log('b) after filtering:', afterFiltering);
    console.log('c) grouped counts per source key:', groupedCounts);
    console.log('placementErrors:', placementErrors.length, placementErrors.slice(0, 3).map(e => e.id));
    console.groupEnd();
  }, [showDebug, events.length, evidenceEvents.length, eventsBySource, placementErrors, sectionSources]);

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
        {/* Temporary debug panel (forensic proof) */}
        {showDebug && (
          <div className="mb-4 rounded-lg border bg-muted/20 p-3">
            <div className="text-xs font-mono space-y-1">
              <div>
                <strong>a) total events:</strong> {events.length}
              </div>
              <div>
                <strong>b) after filtering:</strong> {evidenceEvents.length}
              </div>
              <div className="pt-2">
                <strong>c) grouped counts (source_key → count [sample ids]):</strong>
              </div>
              <div className="space-y-1 pt-1">
                {debugPanelRows.rows.map(r => (
                  <div key={r.source} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="min-w-[120px]">{r.source}</span>
                    <span className="text-muted-foreground">
                      → {r.count}
                      {r.sampleIds.length > 0 ? ` [${r.sampleIds.slice(0, 3).join(', ')}]` : ''}
                    </span>
                  </div>
                ))}

                <div className="flex flex-wrap items-baseline gap-x-2 pt-2">
                  <span className="min-w-[120px] text-destructive">Placement Error</span>
                  <span className="text-destructive">
                    → {debugPanelRows.placementErrorRow.count}
                    {debugPanelRows.placementErrorRow.sampleIds.length > 0
                      ? ` [${debugPanelRows.placementErrorRow.sampleIds.join(', ')}]`
                      : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showChronological ? (
          <ChronologicalView 
            events={evidenceEvents} 
            clientId={clientId}
            showDebug={showDebug}
          />
        ) : (
          <div className="space-y-4">
            {/* Placement Errors - events with invalid/missing sources */}
            {placementErrors.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-destructive">
                  <span>⚠️ Placement Errors ({placementErrors.length})</span>
                </div>
                <div className="border border-destructive/50 rounded-lg p-3 bg-destructive/5">
                  <p className="text-xs text-muted-foreground mb-2">
                    These events have missing/unknown sources or do not match any accordion section key exactly:
                  </p>
                  <div className="space-y-3">
                    {placementErrors.map(event => (
                      <EvidenceItem
                        key={event.id}
                        event={event}
                        clientId={clientId}
                        showDebug={showDebug}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
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
