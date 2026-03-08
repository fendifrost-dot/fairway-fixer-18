/**
 * ChatGPT Import Component
 * 
 * Uses the deterministic parser with full entity support.
 * Displays import health with counts for all entity types.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { parseUpdate, ParseResult } from '@/lib/parser';
import { getFormatExample, getFormatSummary } from '@/lib/parser/formatExample';
import { useBulkCreateTimelineEvents } from '@/hooks/useTimelineEvents';
import { useBulkCreateOperatorTasks } from '@/hooks/useOperatorTasks';
import { ClipboardPaste, Loader2, CheckCircle, AlertCircle, ChevronDown, Copy, Info, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { TimelineEventParsed, ScheduledEvent, UnresolvedItem, DraftItem, NoteFlag } from '@/types/parser';
import { EventSource, EventCategory, RelatedAccount } from '@/types/operator';
 import { isJsonInput, smartImportParse, SmartImportResult, SmartImportEventKind, getAllSources } from '@/lib/smartImport';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { Calendar } from '@/components/ui/calendar';
 import { format, parse } from 'date-fns';
 import { CalendarIcon } from 'lucide-react';

import { selectImportMode, mapTimelineEventToDb } from '@/lib/importRouting';
interface ChatGPTImportProps {
  clientId: string;
  onImportComplete?: (result: ParseResult) => void;
}

export function ChatGPTImport({ clientId, onImportComplete }: ChatGPTImportProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [showFormat, setShowFormat] = useState(false);
   const [smartPreview, setSmartPreview] = useState<SmartImportResult | null>(null);
   const [smartOverrides, setSmartOverrides] = useState<{
     source: EventSource | null;
     event_kind: SmartImportEventKind;
     event_date: string | null;
   } | null>(null);
  
  const createEvents = useBulkCreateTimelineEvents();
  const createTasks = useBulkCreateOperatorTasks();
  
   const isLoading = createEvents.isPending || createTasks.isPending;
   
   // Handle input change - detect Smart Import mode
   const handleInputChange = (value: string) => {
     setInput(value);
     // Reset smart preview when input changes
     setSmartPreview(null);
     setSmartOverrides(null);
   };
   
   // Prepare Smart Import preview
   const prepareSmartImport = () => {
     if (!input.trim()) return;
     
     const parsed = smartImportParse(input.trim());
     setSmartPreview(parsed);
     setSmartOverrides({
       source: parsed.source,
       event_kind: parsed.event_kind,
       event_date: parsed.event_date,
     });
   };
   
   // Confirm Smart Import
   const confirmSmartImport = async () => {
     if (!smartPreview || !smartOverrides) return;
     
     try {
       const eventDate = smartOverrides.event_date;
       const dateIsUnknown = eventDate === null;
       
       // Map event_kind to category
       const categoryMap: Record<SmartImportEventKind, EventCategory> = {
         action: 'Action',
         response: 'Response',
         outcome: 'Outcome',
       };
       
        // Smart Import: Creates exactly ONE timeline_events row
        // - raw_line preserved verbatim
        // - is_draft = false always
        // - date_is_unknown = true iff event_date is NULL
        const dbEvent = {
          client_id: clientId,
          event_date: eventDate,
          date_is_unknown: dateIsUnknown,
          category: categoryMap[smartOverrides.event_kind],
          source: smartOverrides.source,
          title: smartOverrides.event_kind.charAt(0).toUpperCase() + smartOverrides.event_kind.slice(1),
          summary: smartPreview.raw_line.slice(0, 200),
          details: null,
          related_accounts: null,
          raw_line: smartPreview.raw_line,
          is_draft: false,
          event_kind: smartOverrides.event_kind,
        };
       
       await createEvents.mutateAsync([dbEvent]);
       
       toast.success('Smart Import: 1 event created');
       setInput('');
       setSmartPreview(null);
       setSmartOverrides(null);
     } catch (error) {
       toast.error('Smart Import failed: ' + (error as Error).message);
     }
   };
  
  const handleImport = async () => {
    if (!input.trim()) return;
    
     const trimmed = input.trim();
     
     const mode = selectImportMode(trimmed);
     
     if (mode === 'smart') {
       prepareSmartImport();
       return;
     }
     
     // mode === 'json' or 'structured' → parseUpdate path
    
    const parsed = parseUpdate(input, clientId);
    
    // If nothing parsed at all, just show the result with errors
    const totalParsed = 
      parsed.timeline_events.length + 
      parsed.unresolved_items.length +
      parsed.scheduled_events.length +
      parsed.draft_items.length +
      parsed.notes_flags.filter(n => n.flag_type !== 'unrouted_warning').length;
    
    if (totalParsed === 0 && parsed.unrouted_lines.length === 0) {
      setResult(parsed);
      return;
    }
    
    try {
      // Convert parsed timeline events to database format
      const dbEvents = parsed.timeline_events.map(e => mapTimelineEventToDb(e, clientId));
      
      // Convert scheduled events to tasks
      const dbTasks = parsed.scheduled_events.map(e => mapScheduledEventToTask(e, clientId));
      
      // Create events and tasks in parallel
      await Promise.all([
        dbEvents.length > 0 ? createEvents.mutateAsync(dbEvents) : Promise.resolve(),
        dbTasks.length > 0 ? createTasks.mutateAsync(dbTasks) : Promise.resolve(),
      ]);
      
      setResult(parsed);
      
      // Notify parent of import completion (for unresolved items, drafts, notes)
      onImportComplete?.(parsed);
      
      // Clear input on success with no unrouted lines
      if (parsed.errors.length === 0 && parsed.unrouted_lines.length === 0) {
        setInput('');
        toast.success(`Imported ${parsed.timeline_events.length} events, ${parsed.scheduled_events.length} tasks`);
      } else if (parsed.timeline_events.length > 0 || parsed.scheduled_events.length > 0) {
        toast.warning(`Imported with warnings - check import health below`);
      }
    } catch (error) {
      const errorResult: ParseResult = {
        ...parsed,
        errors: [...parsed.errors, (error as Error).message],
      };
      setResult(errorResult);
    }
  };

  const handleCopyFormat = () => {
    navigator.clipboard.writeText(getFormatExample());
    toast.success('Format copied to clipboard');
  };
  
  const evidenceCount = result 
    ? result.counts.actions + result.counts.responses + result.counts.outcomes 
    : 0;
  const hasErrors = result && result.errors.length > 0;
  const hasSuccess = result && (evidenceCount > 0 || result.counts.scheduled > 0);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Paste ChatGPT Update
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFormat(!showFormat)}
            className="text-xs text-muted-foreground"
          >
            <Info className="h-3 w-3 mr-1" />
            View Format
            <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showFormat ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Collapsible open={showFormat} onOpenChange={setShowFormat}>
          <CollapsibleContent>
            <div className="mb-3 p-3 bg-muted/50 rounded-md border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Required Format (pipe-delimited)</span>
                <Button variant="ghost" size="sm" onClick={handleCopyFormat} className="h-6 text-xs">
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Example
                </Button>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 overflow-x-auto max-h-[300px] overflow-y-auto">
                {getFormatSummary()}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Textarea
          placeholder={`COMPLETED ACTIONS:
2025-01-15 | Experian | Dispute Letter | Account XYZ | Certified mail

RESPONSES RECEIVED:
2025-02-10 | Experian | Verified | No docs provided | Account (****1234)

OUTCOMES OBSERVED:
2025-02-15 | Equifax | Account Deleted | Removed from report | -

OPEN / UNRESOLVED ITEMS:
Experian | Collection account | Disputed | ABC Collections | 2025-01-20

SUGGESTED NEXT ACTIONS:
2025-02-25 | File CFPB Complaint | CFPB | High | Re: violation`}
          value={input}
           onChange={(e) => handleInputChange(e.target.value)}
          className="min-h-[180px] font-mono text-sm"
        />
         
         {/* Smart Import Preview */}
         {smartPreview && smartOverrides && (
            <div className="p-3 bg-accent/50 rounded-md border border-accent">
              <div className="text-xs font-medium text-accent-foreground mb-2">
               Smart Import Preview
             </div>
             <div className="text-sm mb-3">
               Will import as: <strong>{smartOverrides.source || 'Unassigned'}</strong> • <strong>{smartOverrides.event_kind}</strong> • <strong>{smartOverrides.event_date || 'Date unknown'}</strong>
             </div>
             
             {/* Override controls */}
             <div className="flex flex-wrap gap-2 mb-3">
               {/* Source override */}
               <Select 
                 value={smartOverrides.source || '_null_'} 
                 onValueChange={(v) => setSmartOverrides(prev => prev ? {...prev, source: v === '_null_' ? null : v as EventSource} : null)}
               >
                 <SelectTrigger className="w-[140px] h-8 text-xs">
                   <SelectValue placeholder="Source" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="_null_">Unassigned</SelectItem>
                   {getAllSources().map(s => (
                     <SelectItem key={s} value={s}>{s}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               
               {/* Event kind override */}
               <Select 
                 value={smartOverrides.event_kind} 
                 onValueChange={(v) => setSmartOverrides(prev => prev ? {...prev, event_kind: v as SmartImportEventKind} : null)}
               >
                 <SelectTrigger className="w-[120px] h-8 text-xs">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="action">action</SelectItem>
                   <SelectItem value="response">response</SelectItem>
                   <SelectItem value="outcome">outcome</SelectItem>
                 </SelectContent>
               </Select>
               
               {/* Date override */}
               <Popover>
                 <PopoverTrigger asChild>
                   <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                     <CalendarIcon className="h-3 w-3" />
                     {smartOverrides.event_date || 'Pick date'}
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-auto p-0" align="start">
                   <Calendar
                     mode="single"
                     selected={smartOverrides.event_date ? parse(smartOverrides.event_date, 'yyyy-MM-dd', new Date()) : undefined}
                     onSelect={(date) => setSmartOverrides(prev => prev ? {...prev, event_date: date ? format(date, 'yyyy-MM-dd') : null} : null)}
                     initialFocus
                   />
                 </PopoverContent>
               </Popover>
             </div>
             
             <div className="flex gap-2">
               <Button size="sm" onClick={confirmSmartImport} disabled={isLoading}>
                 {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                 Confirm Import
               </Button>
               <Button size="sm" variant="ghost" onClick={() => { setSmartPreview(null); setSmartOverrides(null); }}>
                 Cancel
               </Button>
             </div>
           </div>
         )}
        
        <div className="flex items-center justify-between gap-2">
          <Button 
            onClick={handleImport} 
            disabled={!input.trim() || isLoading || !!smartPreview}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </Button>
          
          {result && (
            <div className="text-sm text-muted-foreground flex-1">
              {hasSuccess ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {evidenceCount} evidence, {result.counts.scheduled} tasks
                </span>
              ) : hasErrors ? (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  0 rows parsed
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Import Health Summary */}
        {result && (
          <div className="p-3 bg-muted/50 rounded-md border">
            <div className="text-xs font-medium text-muted-foreground mb-2">Import Health</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <HealthIndicator 
                label="Evidence" 
                count={evidenceCount} 
                colorActive="bg-green-500" 
              />
              <HealthIndicator 
                label="Unresolved" 
                count={result.counts.unresolved} 
                colorActive="bg-amber-500" 
              />
              <HealthIndicator 
                label="Tasks" 
                count={result.counts.scheduled} 
                colorActive="bg-blue-500" 
              />
              <HealthIndicator 
                label="Drafts" 
                count={result.counts.drafts} 
                colorActive="bg-purple-500" 
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2">
              <HealthIndicator 
                label="Notes" 
                count={result.counts.notes} 
                colorActive="bg-slate-500" 
              />
              <HealthIndicator 
                label="Unrouted" 
                count={result.counts.unrouted} 
                colorActive="bg-destructive"
                isError={result.counts.unrouted > 0}
              />
            </div>
            
            {/* Breakdown of evidence types */}
            {evidenceCount > 0 && (
              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                <span className="mr-3">Actions: {result.counts.actions}</span>
                <span className="mr-3">Responses: {result.counts.responses}</span>
                <span>Outcomes: {result.counts.outcomes}</span>
              </div>
            )}
          </div>
        )}

        {/* Unrouted lines warning */}
        {result && result.unrouted_lines.length > 0 && (
          <Alert variant="default" className="mt-2 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <div className="text-xs font-medium text-amber-800 mb-1">
                Unrouted Lines (missing section headers or sources)
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-700">
                {result.unrouted_lines.slice(0, 5).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
                {result.unrouted_lines.length > 5 && (
                  <li className="text-muted-foreground">...and {result.unrouted_lines.length - 5} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {result && result.errors.length > 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-1">
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-xs">{err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li className="text-xs text-muted-foreground">...and {result.errors.length - 5} more errors</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Health indicator component
function HealthIndicator({ 
  label, 
  count, 
  colorActive,
  isError = false 
}: { 
  label: string; 
  count: number; 
  colorActive: string;
  isError?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${count > 0 ? colorActive : 'bg-muted-foreground/30'}`} />
      <span className={isError && count > 0 ? 'text-destructive font-medium' : ''}>
        {label}: {count}
      </span>
    </div>
  );
}

// Map scheduled event to task
function mapScheduledEventToTask(event: ScheduledEvent, clientId: string) {
  const priorityMap: Record<string, 'Low' | 'Medium' | 'High'> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  
  return {
    client_id: clientId,
    title: event.description,
    due_date: event.due_date,
    due_time: null,
    notes: null,
    linked_event_ids: [],
    recurrence_rule: null,
    priority: priorityMap[event.priority] || 'Medium',
    status: 'Open' as const,
  };
}
