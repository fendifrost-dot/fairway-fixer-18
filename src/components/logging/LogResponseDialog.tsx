import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useLogResponse } from '@/hooks/useMutations';
import { useClients, useMatters, useEntityCases } from '@/hooks/useDashboardData';
import { ResponseType, RESPONSE_TYPE_LABELS } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, CalendarIcon, Check, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface LogResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMatterId?: string;
  preselectedEntityCaseId?: string;
}

export function LogResponseDialog({ 
  open, 
  onOpenChange,
  preselectedMatterId,
  preselectedEntityCaseId 
}: LogResponseDialogProps) {
  const [clientId, setClientId] = useState('');
  const [matterId, setMatterId] = useState(preselectedMatterId || '');
  const [entityCaseId, setEntityCaseId] = useState(preselectedEntityCaseId || '');
  const [responseType, setResponseType] = useState<ResponseType | ''>('');
  const [receivedDate, setReceivedDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState('');
  
  const [clientOpen, setClientOpen] = useState(false);

  const { data: clients = [] } = useClients();
  const { data: matters = [] } = useMatters(clientId ? { clientId } : undefined);
  const { data: entityCases = [] } = useEntityCases(matterId);
  const logResponse = useLogResponse();

  // Auto-select matter if client has only one
  useEffect(() => {
    if (clientId && matters.length === 1) {
      setMatterId(matters[0].id);
    }
  }, [clientId, matters]);

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setClientId('');
      setMatterId(preselectedMatterId || '');
      setEntityCaseId(preselectedEntityCaseId || '');
      setResponseType('');
      setReceivedDate(new Date());
      setSummary('');
    }
  }, [open, preselectedMatterId, preselectedEntityCaseId]);

  const handleSubmit = async () => {
    if (!matterId || !entityCaseId || !responseType) {
      toast.error('Matter, entity, and response type are required');
      return;
    }

    try {
      await logResponse.mutateAsync({
        matter_id: matterId,
        entity_case_id: entityCaseId,
        response_type: responseType,
        received_date: receivedDate.toISOString(),
        summary: summary || undefined,
      });
      toast.success('Response logged');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to log response');
    }
  };

  const selectedClient = clients.find(c => c.id === clientId);
  const isHighImpactResponse = responseType === 'Reinserted' || responseType === 'NoResponse';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle>Log Response</DialogTitle>
          <DialogDescription>
            Record a response received from an entity
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client picker */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between bg-background"
                >
                  {selectedClient?.legal_name || "Select client..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-popover z-50">
                <Command>
                  <CommandInput placeholder="Search clients..." />
                  <CommandList>
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.legal_name}
                          onSelect={() => {
                            setClientId(client.id);
                            setMatterId('');
                            setEntityCaseId('');
                            setClientOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clientId === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {client.legal_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Matter picker */}
          <div className="space-y-2">
            <Label>Matter *</Label>
            <Select value={matterId} onValueChange={(v) => { setMatterId(v); setEntityCaseId(''); }}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select matter..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {matters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {matter.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity case picker */}
          <div className="space-y-2">
            <Label>Entity *</Label>
            <Select value={entityCaseId} onValueChange={setEntityCaseId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select entity..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {entityCases.map((ec) => (
                  <SelectItem key={ec.id} value={ec.id}>
                    {ec.entity_name} ({ec.entity_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Response type */}
          <div className="space-y-2">
            <Label>Response Type *</Label>
            <Select value={responseType} onValueChange={(v) => setResponseType(v as ResponseType)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select response type..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {Object.entries(RESPONSE_TYPE_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* High-impact warning */}
          {isHighImpactResponse && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-[hsl(var(--state-violation))]/10 border border-[hsl(var(--state-violation))]/20">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--state-violation))] shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-[hsl(var(--state-violation))]">
                  {responseType === 'Reinserted' ? 'Reinsertion Detected' : 'No Response Violation'}
                </p>
                <p className="text-muted-foreground">
                  {responseType === 'Reinserted' 
                    ? 'This will create a §611(a)(5)(B) violation and update the matter state.'
                    : 'This will create a §611 deadline violation and update the matter state.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label>Received Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left bg-background">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(receivedDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50">
                <Calendar
                  mode="single"
                  selected={receivedDate}
                  onSelect={(d) => d && setReceivedDate(d)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label>Summary {responseType === 'Other' && '*'}</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of the response..."
              rows={2}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} disabled={logResponse.isPending}>
              {logResponse.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Response
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
