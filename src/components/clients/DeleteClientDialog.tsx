import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Download, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { exportClientSnapshot } from '@/hooks/useClientExport';

interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

type DeleteStep = 'confirm' | 'elevated' | 'deleting';

export function DeleteClientDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: DeleteClientDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<DeleteStep>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [elevatedText, setElevatedText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // Preflight: fetch counts
  const { data: preflight } = useQuery({
    queryKey: ['delete-preflight', clientId],
    queryFn: async () => {
      const [mattersRes, eventsRes, tasksRes] = await Promise.all([
        supabase
          .from('matters')
          .select('id, primary_state')
          .eq('client_id', clientId),
        supabase
          .from('timeline_events')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('operator_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
      ]);

      const matters = mattersRes.data || [];
      const riskyStates = matters
        .filter((m) =>
          m.primary_state === 'LitigationReady' ||
          m.primary_state === 'EscalationEligible'
        )
        .map((m) => m.primary_state);

      return {
        matterCount: matters.length,
        eventCount: eventsRes.count || 0,
        taskCount: tasksRes.count || 0,
        hasRiskyStates: riskyStates.length > 0,
        riskyStates: [...new Set(riskyStates)],
      };
    },
    enabled: open,
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep('confirm');
      setConfirmText('');
      setElevatedText('');
      setUnderstood(false);
      setIsDeleting(false);
      setExportDone(false);
    }
  }, [open]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportClientSnapshot(clientId);
      setExportDone(true);
      toast.success('Client snapshot exported');
    } catch (e) {
      toast.error('Export failed: ' + (e as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    // Validation gates
    if (confirmText !== 'DELETE') return;
    if (!understood) return;
    if (preflight?.hasRiskyStates && step === 'confirm') {
      setStep('elevated');
      return;
    }
    if (preflight?.hasRiskyStates && elevatedText !== 'DELETE LITIGATION DATA') return;

    setIsDeleting(true);
    setStep('deleting');

    try {
      const { data, error } = await supabase.rpc(
        'delete_client_cascade' as any,
        {
          _client_id: clientId,
          _elevated_confirm: preflight?.hasRiskyStates || false,
          _export_created: exportDone,
          _reason: null,
        }
      );

      if (error) throw error;

      const result = data as { success: boolean; error?: string; deleted_matters?: number; deleted_events?: number };

      if (!result.success) {
        if (result.error === 'not_authorized') {
          toast.error('Not authorized to delete this client');
        } else if (result.error === 'client_not_found') {
          toast.error('Client not found — may have been already deleted');
        } else {
          toast.error('Deletion failed: ' + result.error);
        }
        setStep('confirm');
        setIsDeleting(false);
        return;
      }

      // Success: invalidate caches and navigate
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.removeQueries({ queryKey: ['client', clientId] });
      queryClient.removeQueries({ queryKey: ['timeline-events', clientId] });
      queryClient.removeQueries({ queryKey: ['operator-tasks', clientId] });

      toast.success(
        `Client deleted. Removed ${result.deleted_matters || 0} matters, ${result.deleted_events || 0} events.`
      );
      onOpenChange(false);
      navigate('/clients');
    } catch (e) {
      toast.error('Deletion failed: ' + (e as Error).message);
      setStep('confirm');
      setIsDeleting(false);
    }
  };

  const canProceed =
    confirmText === 'DELETE' &&
    understood &&
    (!preflight?.hasRiskyStates || step === 'elevated');

  const canExecute =
    canProceed &&
    (!preflight?.hasRiskyStates || elevatedText === 'DELETE LITIGATION DATA');

  return (
    <Dialog open={open} onOpenChange={(v) => !isDeleting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Client Permanently
          </DialogTitle>
        </DialogHeader>

        {step === 'deleting' ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            <p className="text-sm text-muted-foreground">
              Deleting client and all associated data...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Client info + counts */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>This action is irreversible</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  You are about to permanently delete{' '}
                  <strong>{clientName}</strong> and ALL associated data:
                </p>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  <li>{preflight?.matterCount ?? '...'} matter(s)</li>
                  <li>{preflight?.eventCount ?? '...'} timeline event(s)</li>
                  <li>{preflight?.taskCount ?? '...'} task(s)</li>
                  <li>All baselines, violations, deadlines, evidence</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Risky states warning */}
            {preflight?.hasRiskyStates && (
              <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-300">
                  High-risk matters detected
                </AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  This client has matters in:{' '}
                  {preflight.riskyStates.join(', ')}. Elevated confirmation
                  will be required.
                </AlertDescription>
              </Alert>
            )}

            {/* Export before delete */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || exportDone}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                {exportDone
                  ? 'Snapshot exported ✓'
                  : 'Export snapshot before delete'}
              </Button>
            </div>

            {/* Step 1: Type DELETE */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type <code className="px-1 py-0.5 bg-muted rounded text-destructive font-bold">DELETE</code> to confirm
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
                autoComplete="off"
              />
            </div>

            {/* Step 2: Elevated confirmation (if needed and step 1 passed) */}
            {step === 'elevated' && preflight?.hasRiskyStates && (
              <div className="space-y-2 p-3 border border-amber-300 rounded-md bg-amber-50 dark:bg-amber-950/30">
                <label className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  This client has litigation/escalation data. Type{' '}
                  <code className="px-1 py-0.5 bg-muted rounded text-destructive font-bold">
                    DELETE LITIGATION DATA
                  </code>{' '}
                  to proceed
                </label>
                <Input
                  value={elevatedText}
                  onChange={(e) => setElevatedText(e.target.value)}
                  placeholder="Type DELETE LITIGATION DATA"
                  className="font-mono"
                  autoComplete="off"
                  autoFocus
                />
              </div>
            )}

            {/* Checkbox */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="understand-delete"
                checked={understood}
                onCheckedChange={(v) => setUnderstood(v === true)}
              />
              <label htmlFor="understand-delete" className="text-sm leading-tight cursor-pointer">
                I understand this permanently removes client records and linked
                evidence. This cannot be undone.
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={
                  step === 'confirm'
                    ? !canProceed
                    : !canExecute
                }
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Permanently
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
