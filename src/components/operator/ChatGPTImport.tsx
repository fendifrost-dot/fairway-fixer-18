import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseChatGPTUpdate } from '@/lib/chatgptParser';
import { useBulkCreateTimelineEvents } from '@/hooks/useTimelineEvents';
import { useBulkCreateOperatorTasks } from '@/hooks/useOperatorTasks';
import { ClipboardPaste, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ChatGPTImportProps {
  clientId: string;
}

export function ChatGPTImport({ clientId }: ChatGPTImportProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ events: number; tasks: number; errors: string[] } | null>(null);
  
  const createEvents = useBulkCreateTimelineEvents();
  const createTasks = useBulkCreateOperatorTasks();
  
  const isLoading = createEvents.isPending || createTasks.isPending;
  
  const handleImport = async () => {
    if (!input.trim()) return;
    
    const parsed = parseChatGPTUpdate(input, clientId);
    
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
      });
      
      // Clear input on success
      if (parsed.errors.length === 0) {
        setInput('');
      }
    } catch (error) {
      setResult({
        events: 0,
        tasks: 0,
        errors: [(error as Error).message],
      });
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4" />
          Paste ChatGPT Update
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder={`CLIENT_UPDATE:
Client: John Doe

Completed:
- LexisNexis Freeze | 2024-01-15 | Submitted online
- Experian Dispute | 2024-01-20 | Account XYZ

Responses:
- Experian | 2024-02-10 | Verified as accurate | No documentation provided

Outcomes:
- 2024-02-15 | Innovis removed 2 accounts

ToDo:
- File CFPB Complaint | Due: 2024-02-20 | Priority: High`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[150px] font-mono text-sm"
        />
        
        <div className="flex items-center justify-between">
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
            <div className="text-sm text-muted-foreground">
              {result.errors.length === 0 ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {result.events} events, {result.tasks} tasks created
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  {result.events} events, {result.tasks} tasks ({result.errors.length} errors)
                </span>
              )}
            </div>
          )}
        </div>
        
        {result && result.errors.length > 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs">{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
