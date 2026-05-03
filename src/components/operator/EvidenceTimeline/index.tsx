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
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';
import { FileText, Building2, Database, Shield, Bug, Plus, Layers, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEvent, EventSource, SOURCE_ACCORDION_STRUCTURE } from '@/types/operator';
import { useCreateSourceCorrection } from '@/hooks/useSourceCorrections';
import { useDisputeRounds } from '@/hooks/useDisputeRounds';
import { useFurnishers } from '@/hooks/useFurnishers';
import { useUpdateTimelineEvent } from '@/hooks/useTimelineEvents';
import { EvidenceTimelineProps } from './types';
import { SourceSection } from './SourceSection';
import { FurnisherSection } from './FurnisherSection';
import { ChronologicalView } from './ChronologicalView';
import { EvidenceItem } from './EvidenceItem';
import { AddEntryDialog } from './AddEntryDialog';
import { EditEntryDialog } from './EditEntryDialog';
import { expandAllCrasEvents, isAllCrasSource } from '@/lib/allCrasExpander';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Credit Bureaus': Building2,
  'Data Brokers': Database,
  'Regulatory': Shield,
  'Furnishers': Building2,
};

export function EvidenceTimeline({ events, clientId }: EvidenceTimelineProps) {
  const [showChronological, setShowChronological] = useState(false);
  const [byRound, setByRound] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const createCorrection = useCreateSourceCorrection();
  const { data: rounds = [] } = useDisputeRounds(clientId);
  const { data: furnishers = [] } = useFurnishers(clientId);
  const updateEvent = useUpdateTimelineEvent();

  // 24h "Auto-extracted on intake" badge
  const { data: autoExtractedAt } = useQuery({
    queryKey: ['client-auto-extracted-at', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('intake_auto_extracted_at')
        .eq('id', clientId)
        .maybeSingle();
      if (error) return null;
      return (data as { intake_auto_extracted_at: string | null } | null)?.intake_auto_extracted_at ?? null;
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });
  const showAutoExtractBadge = useMemo(() => {
    if (!autoExtractedAt) return false;
    const ts = new Date(autoExtractedAt).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < 24 * 60 * 60 * 1000;
  }, [autoExtractedAt]);

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
  // Note: "All CRAs" events have already been expanded above via expandAllCrasEvents,
  // so they now have valid bureau sources (Experian/TransUnion/Equifax)
  const { eventsBySource, placementErrors } = useMemo(() => {
    const grouped: Record<string, TimelineEvent[]> = {};
    const errors: TimelineEvent[] = [];

    evidenceEvents.forEach(event => {
      const source = event.source;

      // Placement error cases (AFTER expansion has already run):
      // 1. Source is null/missing
      // 2. Source doesn't match any accordion section key
      // 3. Source explicitly matches "All CRAs" patterns (defensive - shouldn't happen after expansion)
      if (!source || !sectionKeySet.has(source as EventSource) || isAllCrasSource(source)) {
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

  // By-Round grouping (built when byRound is on)
  const eventsByRound = useMemo(() => {
    if (!byRound) return null;
    const map = new Map<string, TimelineEvent[]>(); // key = roundId or '__unassigned__'
    for (const ev of evidenceEvents) {
      const key = ev.round_id || '__unassigned__';
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [byRound, evidenceEvents]);

  // Furnisher grouping (B4): bucket events by furnisher_id (only those with a furnisher)
  const eventsByFurnisher = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of evidenceEvents) {
      if (!ev.furnisher_id) continue;
      const arr = map.get(ev.furnisher_id) || [];
      arr.push(ev);
      map.set(ev.furnisher_id, arr);
    }
    return map;
  }, [evidenceEvents]);

  const furnishersWithAny = useMemo(() => {
    // Show furnishers that either have at least one attached event OR exist in
    // the table for this client. Per spec: render the group only when the
    // client has at least one furnisher row.
    return furnishers;
  }, [furnishers]);

  const handleAssignRound = (eventId: string, roundId: string | null) => {
    updateEvent.mutate({
      id: eventId,
      clientId,
      updates: { round_id: roundId },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Evidence Timeline ({evidenceEvents.length})
            {showAutoExtractBadge && (
              <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                <Sparkles className="h-3 w-3" />
                Auto-extracted on intake
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Add Entry button */}
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} className="gap-1">
              <Plus className="h-3 w-3" />
              Add Entry
            </Button>
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
            {/* By Round toggle */}
            <div className="flex items-center gap-2">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <Label htmlFor="by-round-toggle" className="text-xs text-muted-foreground">
                By Round
              </Label>
              <Switch
                id="by-round-toggle"
                checked={byRound}
                onCheckedChange={(v) => {
                  setByRound(v);
                  if (v) setShowChronological(false);
                }}
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
                onCheckedChange={(v) => {
                  setShowChronological(v);
                  if (v) setByRound(false);
                }}
                disabled={byRound}
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

        {byRound && eventsByRound ? (
          <div className="space-y-6">
            {/* Unassigned first */}
            {(eventsByRound.get('__unassigned__') || []).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <Layers className="h-4 w-4" />
                  <span>Unassigned ({(eventsByRound.get('__unassigned__') || []).length})</span>
                </div>
                <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                  {(eventsByRound.get('__unassigned__') || []).map(ev => (
                    <div key={ev.id} className="flex items-start gap-2">
                      <div className="flex-1">
                        <EvidenceItem
                          event={ev}
                          clientId={clientId}
                          showDebug={showDebug}
                          onEdit={setEditingEvent}
                        />
                      </div>
                      {rounds.length > 0 && (
                        <Select
                          value=""
                          onValueChange={(v) => handleAssignRound(ev.id, v)}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue placeholder="Assign…" />
                          </SelectTrigger>
                          <SelectContent>
                            {rounds.map(r => (
                              <SelectItem key={r.id} value={r.id} className="text-xs">
                                Round {r.round_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rounds.map(round => {
              const list = eventsByRound.get(round.id) || [];
              return (
                <div key={round.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Layers className="h-4 w-4" />
                      <span>Round {round.round_number} ({list.length})</span>
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-3 py-2 border rounded-md">
                      No events attached to this round yet.
                    </p>
                  ) : (
                    <div className="space-y-3 border rounded-lg p-3">
                      {list.map(ev => (
                        <div key={ev.id} className="flex items-start gap-2">
                          <div className="flex-1">
                            <EvidenceItem
                              event={ev}
                              clientId={clientId}
                              showDebug={showDebug}
                              onEdit={setEditingEvent}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleAssignRound(ev.id, null)}
                          >
                            Unassign
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : showChronological ? (
          <ChronologicalView 
            events={evidenceEvents} 
            clientId={clientId}
            showDebug={showDebug}
            onEdit={setEditingEvent}
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
                        onEdit={setEditingEvent}
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
                        onEdit={setEditingEvent}
                      />
                    ))}
                  </Accordion>
                </div>
              );
            })}

            {/* Furnishers (B4) — only when at least one furnisher exists */}
            {furnishersWithAny.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>Furnishers</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {furnishersWithAny.length}
                  </Badge>
                </div>
                <Accordion type="multiple" className="w-full">
                  {furnishersWithAny.map(f => (
                    <FurnisherSection
                      key={f.id}
                      furnisher={f}
                      events={eventsByFurnisher.get(f.id) || []}
                      clientId={clientId}
                      showDebug={showDebug}
                      onEdit={setEditingEvent}
                    />
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Dialogs */}
      <AddEntryDialog open={showAddDialog} onOpenChange={setShowAddDialog} clientId={clientId} />
      <EditEntryDialog open={!!editingEvent} onOpenChange={(open) => { if (!open) setEditingEvent(null); }} event={editingEvent} clientId={clientId} />
    </Card>
  );
}

// Re-export for backwards compatibility
export { EvidenceTimeline as default };
