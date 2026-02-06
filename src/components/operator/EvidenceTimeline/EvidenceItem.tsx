/**
 * Evidence Item Component
 * 
 * Single timeline event with debug placement info and drag handle.
 */

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, MessageSquare, CheckCircle2, FileText, Trash2, GripVertical, Copy, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteTimelineEvent } from '@/hooks/useTimelineEvents';
import { useCreateSourceCorrection } from '@/hooks/useSourceCorrections';
import { ALL_EVIDENCE_SOURCES, TimelineEvent, SOURCE_DISPLAY_NAMES, EventSource } from '@/types/operator';
import { EvidenceItemProps, EvidenceCategory, PlacementDebug } from './types';

const categoryConfig: Record<EvidenceCategory, { 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bgColor: string; 
  label: string 
}> = {
  Action: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' },
  Response: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Response' },
  Outcome: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Outcome' },
  Note: { icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Note' },
};

function getPlacementDebug(event: TimelineEvent): PlacementDebug {
  const source = event.source || 'unassigned';
  const kind = event.category.toLowerCase();
  const date = event.event_date || 'unknown';
  
  // Determine which group this source belongs to
  let groupName = 'Unknown';
  const sourceUpper = event.source?.toUpperCase() || '';
  if (['EXPERIAN', 'TRANSUNION', 'EQUIFAX'].includes(sourceUpper)) {
    groupName = 'Credit Bureaus';
  } else if (['INNOVIS', 'LEXISNEXIS', 'SAGESTREAM', 'CORELOGIC', 'CHEXSYSTEMS', 'EWS', 'NCTUE'].includes(sourceUpper)) {
    groupName = 'Data Brokers';
  } else if (['CFPB', 'BBB', 'AG', 'FTC'].includes(sourceUpper)) {
    groupName = 'Regulatory';
  }
  
  const placedIn = `${groupName} > ${SOURCE_DISPLAY_NAMES[event.source as EventSource] || event.source || 'None'}`;
  
  return { source, kind, date, placedIn };
}

export function EvidenceItem({ event, clientId, showDebug = false, onDragStart }: EvidenceItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRawLineExpanded, setIsRawLineExpanded] = useState(false);
  const deleteEvent = useDeleteTimelineEvent();
  const createCorrection = useCreateSourceCorrection();
  
  const selectValue = useMemo(() => {
    const source = event.source;
    if (!source) return undefined;
    return ALL_EVIDENCE_SOURCES.includes(source) ? source : undefined;
  }, [event.source]);

  const selectPlaceholder = useMemo(() => {
    if (!event.source) return 'Unassigned';
    return (SOURCE_DISPLAY_NAMES[event.source as EventSource] || event.source) as string;
  }, [event.source]);

  const config = categoryConfig[event.category as EvidenceCategory];
  
  if (!config) return null;
  
  const Icon = config.icon;
  const hasExpandableContent = event.details || (event.related_accounts && event.related_accounts.length > 0);
  const debug = getPlacementDebug(event);

  const isDateUnknown = !event.event_date || !!event.date_is_unknown;
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(event);
  };

  const handleManualAssignSource = (toSource: EventSource) => {
    const current = event.source;
    if (current === toSource) return;

    createCorrection.mutate({
      eventId: event.id,
      fromSource: current ?? 'Unassigned',
      toSource,
      clientId,
      method: 'manual',
      notes: 'manual correction',
    });
  };
  
  return (
    <div className="flex gap-2 group border-l-2 border-transparent hover:border-primary/30 pl-1">
      {/* Drag handle - ALWAYS VISIBLE */}
      <div 
        className="flex-shrink-0 cursor-grab active:cursor-grabbing bg-muted/50 rounded px-0.5 hover:bg-muted"
        draggable
        onDragStart={handleDragStart}
        title="Drag to move to different source"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
      {/* Icon */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {isDateUnknown ? 'Date unknown' : format(parseISO(event.event_date!), 'MMM d, yyyy')}
                </span>

                {/* Manual operator override (does not depend on drag-and-drop) */}
                <Select
                  value={selectValue}
                  onValueChange={(value) => handleManualAssignSource(value as EventSource)}
                >
                  <SelectTrigger className="h-6 w-[160px] text-xs">
                    <SelectValue placeholder={selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_EVIDENCE_SOURCES.map(source => (
                      <SelectItem key={source} value={source}>
                        {SOURCE_DISPLAY_NAMES[source] || source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="font-medium mt-1 text-sm">{event.title}</p>
              <p className="text-sm text-muted-foreground">{event.summary}</p>
              
              {/* Debug placement line - shows id, source, summary, raw_line, category, event_kind */}
              {showDebug && (
                <div className="text-[10px] font-mono bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-1 rounded mt-1 border border-yellow-300 dark:border-yellow-700">
                  <div className="text-yellow-800 dark:text-yellow-200">
                    <strong>id:</strong> {event.id}
                  </div>
                  <div className="text-yellow-800 dark:text-yellow-200">
                    <strong>source:</strong> {event.source || 'NULL'} | 
                    <strong> category:</strong> {event.category} |
                    <strong> event_kind:</strong> {event.event_kind || 'NULL'}
                  </div>
                  <div className="text-yellow-800 dark:text-yellow-200 break-all">
                    <strong>summary:</strong> {event.summary}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>raw_line:</strong>
                    <pre className="whitespace-pre-wrap break-words text-[10px] mt-1">
                      {event.raw_line || 'NULL'}
                    </pre>
                  </div>
                  <div className="text-muted-foreground">
                    placed_in: {debug.placedIn}
                  </div>
                </div>
              )}
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
