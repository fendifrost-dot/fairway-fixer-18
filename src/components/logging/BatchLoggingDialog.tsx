import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { useClients, useMatters, useEntityCases } from '@/hooks/useDashboardData';
import { useLogAction, useLogResponse } from '@/hooks/useMutations';
import { ACTION_TYPES, RESPONSE_TYPE_LABELS, ResponseType, ActionType } from '@/types/database';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BatchLoggingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'action' | 'response';
}

interface BatchEntry {
  id: string;
  clientId: string;
  matterId: string;
  entityCaseId: string;
  type: string;
  date: string;
  summary: string;
}

export function BatchLoggingDialog({ open, onOpenChange, mode }: BatchLoggingDialogProps) {
  const { data: clients = [] } = useClients();
  const { data: allMatters = [] } = useMatters();
  const logAction = useLogAction();
  const logResponse = useLogResponse();

  const [entries, setEntries] = useState<BatchEntry[]>([{
    id: crypto.randomUUID(),
    clientId: '',
    matterId: '',
    entityCaseId: '',
    type: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    summary: '',
  }]);
  const [lastSelection, setLastSelection] = useState<Partial<BatchEntry>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get matters for each entry's client
  const getMattersForClient = (clientId: string) => {
    return allMatters.filter(m => m.client_id === clientId);
  };

  // Get entity cases for each entry's matter
  const { data: entityCases = [] } = useEntityCases(entries[0]?.matterId);

  const addEntry = () => {
    const newEntry: BatchEntry = {
      id: crypto.randomUUID(),
      clientId: '',
      matterId: '',
      entityCaseId: '',
      type: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      summary: '',
    };
    setEntries([...entries, newEntry]);
  };

  const duplicateLast = () => {
    if (entries.length === 0) return;
    const last = entries[entries.length - 1];
    const newEntry: BatchEntry = {
      ...last,
      id: crypto.randomUUID(),
    };
    setEntries([...entries, newEntry]);
  };

  const removeEntry = (id: string) => {
    if (entries.length === 1) return;
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof BatchEntry, value: string) => {
    setEntries(entries.map(e => {
      if (e.id !== id) return e;
      
      const updated = { ...e, [field]: value };
      
      // Reset dependent fields
      if (field === 'clientId') {
        updated.matterId = '';
        updated.entityCaseId = '';
      }
      if (field === 'matterId') {
        updated.entityCaseId = '';
      }
      
      // Save as last selection
      setLastSelection(updated);
      
      return updated;
    }));
  };

  const applyLastSelection = (id: string) => {
    if (!lastSelection.clientId) return;
    setEntries(entries.map(e => {
      if (e.id !== id) return e;
      return {
        ...e,
        clientId: lastSelection.clientId || e.clientId,
        matterId: lastSelection.matterId || e.matterId,
        entityCaseId: lastSelection.entityCaseId || e.entityCaseId,
        type: lastSelection.type || e.type,
      };
    }));
  };

  const handleSubmit = async () => {
    // Validate all entries
    const invalidEntries = entries.filter(e => !e.clientId || !e.matterId || !e.entityCaseId || !e.type);
    if (invalidEntries.length > 0) {
      toast.error(`${invalidEntries.length} entries are incomplete`);
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of entries) {
      try {
        if (mode === 'action') {
          await logAction.mutateAsync({
            matter_id: entry.matterId,
            entity_case_id: entry.entityCaseId,
            action_type: entry.type,
            action_date: entry.date,
            summary: entry.summary || undefined,
          });
        } else {
          await logResponse.mutateAsync({
            matter_id: entry.matterId,
            entity_case_id: entry.entityCaseId,
            response_type: entry.type as ResponseType,
            received_date: entry.date,
            summary: entry.summary || undefined,
          });
        }
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      toast.success(`${successCount} ${mode}${successCount > 1 ? 's' : ''} logged successfully`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} entries failed to log`);
    }

    if (errorCount === 0) {
      onOpenChange(false);
      setEntries([{
        id: crypto.randomUUID(),
        clientId: '',
        matterId: '',
        entityCaseId: '',
        type: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        summary: '',
      }]);
    }
  };

  const typeOptions = mode === 'action' 
    ? ACTION_TYPES 
    : Object.keys(RESPONSE_TYPE_LABELS) as ResponseType[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>
            Batch Log {mode === 'action' ? 'Actions' : 'Responses'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addEntry}>
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={duplicateLast}
              disabled={entries.length === 0}
            >
              <Copy className="h-4 w-4 mr-1" />
              Duplicate Last
            </Button>
            {lastSelection.clientId && (
              <span className="text-xs text-muted-foreground">
                Last: {clients.find(c => c.id === lastSelection.clientId)?.preferred_name || 'Unknown'}
              </span>
            )}
          </div>

          {/* Entries */}
          <div className="space-y-3">
            {entries.map((entry, index) => {
              const clientMatters = getMattersForClient(entry.clientId);
              const selectedMatter = clientMatters.find(m => m.id === entry.matterId);
              
              return (
                <Card key={entry.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-mono text-muted-foreground w-6 pt-2">
                      {index + 1}.
                    </span>
                    
                    <div className="flex-1 grid grid-cols-6 gap-2">
                      {/* Client */}
                      <div>
                        <Label className="text-xs">Client</Label>
                        <Select
                          value={entry.clientId}
                          onValueChange={(v) => updateEntry(entry.id, 'clientId', v)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {clients.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.preferred_name || c.legal_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Matter */}
                      <div>
                        <Label className="text-xs">Matter</Label>
                        <Select
                          value={entry.matterId}
                          onValueChange={(v) => updateEntry(entry.id, 'matterId', v)}
                          disabled={!entry.clientId}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {clientMatters.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Entity */}
                      <div>
                        <Label className="text-xs">Entity</Label>
                        <Select
                          value={entry.entityCaseId}
                          onValueChange={(v) => updateEntry(entry.id, 'entityCaseId', v)}
                          disabled={!entry.matterId}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {entityCases.map(e => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.entity_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Type */}
                      <div>
                        <Label className="text-xs">{mode === 'action' ? 'Action' : 'Response'}</Label>
                        <Select
                          value={entry.type}
                          onValueChange={(v) => updateEntry(entry.id, 'type', v)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {typeOptions.map(t => (
                              <SelectItem key={t} value={t}>
                                {mode === 'action' ? t : RESPONSE_TYPE_LABELS[t as ResponseType]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Date */}
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={entry.date}
                          onChange={(e) => updateEntry(entry.id, 'date', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Summary */}
                      <div>
                        <Label className="text-xs">Summary</Label>
                        <Input
                          value={entry.summary}
                          onChange={(e) => updateEntry(entry.id, 'summary', e.target.value)}
                          placeholder="Optional note..."
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 pt-5">
                      {lastSelection.clientId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyLastSelection(entry.id)}
                          className="h-8 w-8 p-0"
                          title="Apply last selection"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntry(entry.id)}
                        disabled={entries.length === 1}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging...
              </>
            ) : (
              `Log ${entries.length} ${mode === 'action' ? 'Action' : 'Response'}${entries.length > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
