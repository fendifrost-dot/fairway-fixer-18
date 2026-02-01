import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { parseChatGPTUpdate, getFormatExample, ParseCounts } from '@/lib/chatgptParser';
import { useBulkCreateTimelineEvents } from '@/hooks/useTimelineEvents';
import { useBulkCreateOperatorTasks } from '@/hooks/useOperatorTasks';
import { ClipboardPaste, Loader2, CheckCircle, AlertCircle, ChevronDown, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';

interface ChatGPTImportProps {
  clientId: string;
}

interface ImportResult {
  events: number;
  tasks: number;
  errors: string[];
  counts: ParseCounts;
}

export function ChatGPTImport({ clientId }: ChatGPTImportProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  
  const createEvents = useBulkCreateTimelineEvents();
  const createTasks = useBulkCreateOperatorTasks();
  
  const isLoading = createEvents.isPending || createTasks.isPending;
  
  const handleImport = async () => {
    if (!input.trim()) return;
    
    const parsed = parseChatGPTUpdate(input, clientId);
    
    // If nothing parsed, just show the error
    if (parsed.events.length === 0 && parsed.tasks.length === 0) {
      setResult({
        events: 0,
        tasks: 0,
        errors: parsed.errors,
        counts: parsed.counts,
      });
      return;
    }
    
    try {
      // Create events and tasks in parallel
      await Promise.all([
        parsed.events.length > 0 ? createEvents.mutateAsync(parsed.events) : Promise.resolve(),
        parsed.tasks.length > 0 ? createTasks.mutateAsync(parsed.tasks) : Promise.resolve(),
      ]);
      
      setResult({
        events: parsed.events.length,
        tasks: parsed.tasks.length,
        errors: parsed.errors,
        counts: parsed.counts,
      });
      
      // Clear input on full success
      if (parsed.errors.length === 0) {
        setInput('');
        toast.success(`Imported ${parsed.events.length} events and ${parsed.tasks.length} tasks`);
      }
    } catch (error) {
      setResult({
        events: 0,
        tasks: 0,
        errors: [(error as Error).message],
        counts: parsed.counts,
      });
    }
  };

  const handleCopyFormat = () => {
    navigator.clipboard.writeText(getFormatExample());
    toast.success('Format copied to clipboard');
  };
  
  const totalParsed = result ? result.events + result.tasks : 0;
  const hasErrors = result && result.errors.length > 0;
  const hasSuccess = result && totalParsed > 0;
  
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
                  Copy
                </Button>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 overflow-x-auto">
{`Completed:
DATE | ACTION_TYPE | ENTITY | DETAILS | PROOF

Responses:
DATE | ENTITY | RESPONSE_TYPE | DETAILS | ACCOUNT

Outcomes:
DATE | ENTITY | OUTCOME_TYPE | DETAILS | ACCOUNT

ToDo:
DUE_DATE | TASK | ENTITY | PRIORITY | DETAILS

Notes:
DATE | NOTE`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Dates: YYYY-MM-DD or MM/DD/YYYY
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Textarea
          placeholder={`Completed:
2025-01-15 | Freeze Request | LexisNexis | Submitted online | Screenshot
2025-01-20 | Dispute Letter | Experian | Account XYZ | Certified mail

Responses:
2025-02-10 | Experian | Verified | No docs provided | Account (****1234)

Outcomes:
2025-02-15 | Innovis | Deleted | 2 accounts removed | -

ToDo:
2025-02-20 | File CFPB Complaint | CFPB | High | Re: violation

Notes:
2025-01-18 | Client confirmed ID theft report filed`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[180px] font-mono text-sm"
        />
        
        <div className="flex items-center justify-between gap-2">
          <Button 
            onClick={handleImport} 
            disabled={!input.trim() || isLoading}
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
                  {result.events} events, {result.tasks} tasks
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

        {/* Detailed counts */}
        {result && (result.events > 0 || result.tasks > 0) && (
          <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pt-1">
            {result.counts.completed > 0 && <span>Completed: {result.counts.completed}</span>}
            {result.counts.responses > 0 && <span>Responses: {result.counts.responses}</span>}
            {result.counts.outcomes > 0 && <span>Outcomes: {result.counts.outcomes}</span>}
            {result.counts.todo > 0 && <span>ToDo: {result.counts.todo}</span>}
            {result.counts.notes > 0 && <span>Notes: {result.counts.notes}</span>}
          </div>
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
