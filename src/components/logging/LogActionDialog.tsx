import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useLogAction } from '@/hooks/useMutations';
import { useClients, useMatters, useEntityCases } from '@/hooks/useDashboardData';
import { ACTION_TYPES, EvidenceType, DbMatter } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface LogActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMatterId?: string;
  preselectedEntityCaseId?: string;
}

export function LogActionDialog({ 
  open, 
  onOpenChange,
  preselectedMatterId,
  preselectedEntityCaseId 
}: LogActionDialogProps) {
  const [clientId, setClientId] = useState('');
  const [matterId, setMatterId] = useState(preselectedMatterId || '');
  const [entityCaseId, setEntityCaseId] = useState(preselectedEntityCaseId || '');
  const [actionType, setActionType] = useState('');
  const [actionDate, setActionDate] = useState<Date>(new Date());
  const [deliveredDate, setDeliveredDate] = useState<Date | undefined>();
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('Unknown');
  const [summary, setSummary] = useState('');
  
  const [clientOpen, setClientOpen] = useState(false);

  const { data: clients = [] } = useClients();
  const { data: matters = [] } = useMatters(clientId ? { clientId } : undefined);
  const { data: entityCases = [] } = useEntityCases(matterId);
  const logAction = useLogAction();

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
      setActionType('');
      setActionDate(new Date());
      setDeliveredDate(undefined);
      setEvidenceType('Unknown');
      setSummary('');
    }
  }, [open, preselectedMatterId, preselectedEntityCaseId]);

  const handleSubmit = async () => {
    if (!matterId || !actionType) {
      toast.error('Matter and action type are required');
      return;
    }

    try {
      await logAction.mutateAsync({
        matter_id: matterId,
        entity_case_id: entityCaseId || undefined,
        action_type: actionType,
        action_date: actionDate.toISOString(),
        delivered_date: deliveredDate?.toISOString(),
        evidence_type: evidenceType,
        summary: summary || undefined,
      });
      toast.success('Action logged');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to log action');
    }
  };

  const selectedClient = clients.find(c => c.id === clientId);
  const showDeliveredDate = actionType === 'Dispute Sent' || actionType === 'Demand Letter Sent';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle>Log Action</DialogTitle>
          <DialogDescription>
            Record an action you've taken on a matter
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
            <Label>Entity (optional)</Label>
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

          {/* Action type */}
          <div className="space-y-2">
            <Label>Action Type *</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Action Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left bg-background">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(actionDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover z-50">
                  <Calendar
                    mode="single"
                    selected={actionDate}
                    onSelect={(d) => d && setActionDate(d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {showDeliveredDate && (
              <div className="space-y-2">
                <Label>Delivered Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left bg-background">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveredDate ? format(deliveredDate, 'MMM d, yyyy') : 'Select...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50">
                    <Calendar
                      mode="single"
                      selected={deliveredDate}
                      onSelect={setDeliveredDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Evidence type */}
          <div className="space-y-2">
            <Label>Evidence Type</Label>
            <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="Mail">Mail</SelectItem>
                <SelectItem value="Portal">Portal</SelectItem>
                <SelectItem value="Report">Report</SelectItem>
                <SelectItem value="ClientStatement">Client Statement</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label>Summary (optional)</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of the action..."
              rows={2}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} disabled={logAction.isPending}>
              {logAction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Action
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
