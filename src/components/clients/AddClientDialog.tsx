import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardPaste, UserPlus, Loader2, ChevronDown, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import type { Database } from '@/integrations/supabase/types';

type MatterType = Database['public']['Enums']['matter_type'];

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddClientDialog({ open, onOpenChange, onSuccess }: AddClientDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'paste' | 'manual'>('paste');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<null | { friendly: string; technical?: string }>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Diagnostics
  const [whoamiText, setWhoamiText] = useState<string>('(not run yet)');
  const [whoamiStatus, setWhoamiStatus] = useState<'unknown' | 'authenticated' | 'unauthenticated' | 'error'>('unknown');
  const [whoamiLoading, setWhoamiLoading] = useState(false);
  const [lastWhoamiSnapshot, setLastWhoamiSnapshot] = useState<string>('(not run yet)');

  // Paste intake state
  const [intakeText, setIntakeText] = useState('');

  // Quick manual state
  const [legalName, setLegalName] = useState('');
  const [matterType, setMatterType] = useState<MatterType>('Credit');
  const [issueNote, setIssueNote] = useState('');

  // Auto-focus textarea when dialog opens in paste mode
  useEffect(() => {
    if (open && mode === 'paste') {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, mode]);

  // REQUIRED: auto-run WHOAMI every time the modal opens
  useEffect(() => {
    if (!open) {
      setWhoamiStatus('unknown');
      setWhoamiText('(not run yet)');
      setLastWhoamiSnapshot('(not run yet)');
      setWhoamiLoading(false);
      return;
    }

    setWhoamiStatus('unknown');
    setWhoamiText('(running...)');
    setWhoamiLoading(true);
    void runWhoami().finally(() => setWhoamiLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setIntakeText('');
    setLegalName('');
    setMatterType('Credit');
    setIssueNote('');
    setMode('paste');
    setSubmitError(null);
    setShowErrorDetails(false);
  };


  const buildTechnicalError = (error: unknown): string | undefined => {
    if (!error) return undefined;
    try {
      if (typeof error === 'object') {
        const anyErr = error as any;
        const safe = {
          message: anyErr?.message,
          code: anyErr?.code,
          details: anyErr?.details,
          hint: anyErr?.hint,
          stage: anyErr?.stage,
          rollback: anyErr?.rollback,
        };
        return JSON.stringify(safe, null, 2);
      }
      return String(error);
    } catch {
      return String(error);
    }
  };

  const runWhoami = async () => {
    setWhoamiLoading(true);
    try {
      const { data, error } = await supabase.rpc('whoami');
      if (error) {
        // If user is not authenticated, this can legitimately fail due to EXECUTE privilege.
        // Treat as unauthenticated for gating purposes.
        const text = `whoami() error:\n${JSON.stringify(error, null, 2)}`;
        setWhoamiStatus('unauthenticated');
        setWhoamiText(text);
        setLastWhoamiSnapshot(text);
        return { ok: false, uid: null as string | null, role: null as string | null, text };
      }

      const row = Array.isArray(data) ? data[0] : data;
      const uid = row?.uid ?? null;
      const role = row?.role ?? null;
      const text = JSON.stringify(row, null, 2);
      setWhoamiText(text);
      setLastWhoamiSnapshot(text);

      const ok = Boolean(uid) && role === 'authenticated';
      setWhoamiStatus(ok ? 'authenticated' : 'unauthenticated');
      return { ok, uid, role, text };
    } catch (e) {
      const text = `whoami() exception:\n${buildTechnicalError(e) ?? String(e)}`;
      setWhoamiStatus('error');
      setWhoamiText(text);
      setLastWhoamiSnapshot(text);
      return { ok: false, uid: null as string | null, role: null as string | null, text };
    } finally {
      setWhoamiLoading(false);
    }
  };

  // Temporary test function to diagnose RLS
  const runRlsTest = async () => {
    try {
      const { data, error } = await supabase.rpc('test_matters_insert_rls');
      if (error) {
        toast.error('RLS test failed');
        console.log('RLS Test Error:', JSON.stringify(error, null, 2));
        setWhoamiText(prev => prev + '\n\n--- RLS TEST RESULT ---\n' + JSON.stringify(error, null, 2));
      } else {
        toast.success('RLS test passed!');
        console.log('RLS Test Success:', JSON.stringify(data, null, 2));
        setWhoamiText(prev => prev + '\n\n--- RLS TEST RESULT ---\n' + JSON.stringify(data, null, 2));
      }
    } catch (e) {
      toast.error('RLS test exception');
      console.log('RLS Test Exception:', e);
      setWhoamiText(prev => prev + '\n\n--- RLS TEST EXCEPTION ---\n' + String(e));
    }
  };

  /**
   * DEBUG RPC: instrumented client+matter creation
   * Now returns jsonb with full diagnostics including visibility assertion and detailed error info.
   */
  const createClientAndMatter = async (
    clientName: string,
    rawIntakeText: string | null,
    source: string,
    noteText?: string
  ) => {
    // Preflight auth check
    const who = await runWhoami();
    if (!who.ok) {
      const friendly = 'Not authenticated — cannot create matter.';
      setSubmitError({
        friendly,
        technical: `WHOAMI (preflight)\n${who.text ?? lastWhoamiSnapshot}`,
      });
      toast.error('Not authenticated');
      return null;
    }

    // Call the patched debug RPC (now returns jsonb)
    const { data, error } = await supabase.rpc('debug_create_client_and_matter', {
      _legal_name: (clientName || 'New Client').trim().substring(0, 100) || 'New Client',
      _matter_type: matterType,
      _intake_raw_text: rawIntakeText || '',
      _intake_source: source,
      _client_notes: noteText || null,
    });

    const debugPayload = JSON.stringify({ rpc_response: data, rpc_error: error, whoami: who.text }, null, 2);

    if (error) {
      throw { stage: 'rpc_call', debugPayload, ...error };
    }

    if (!data) {
      throw { stage: 'rpc_call', debugPayload, message: 'No data returned from server' };
    }

    // The RPC now returns a single jsonb object, not an array
    const result = data as {
      caller_uid: string;
      inserted_client_id: string | null;
      inserted_client_owner_id?: string;
      client_visible_after_insert: boolean;
      inserted_matter_id?: string | null;
      attempted_matter_client_id?: string;
      attempted_matter_owner_id?: string;
      error_code?: string;
      error_message?: string;
      error_detail?: string;
      error_hint?: string;
      error_table?: string;
      error_column?: string;
      error_constraint?: string;
      error_stage?: string;
      success?: boolean;
    };

    // Check if the RPC caught an error
    if (result.error_code) {
      throw {
        stage: result.error_stage || 'rpc_insert',
        debugPayload,
        code: result.error_code,
        message: result.error_message,
        detail: result.error_detail,
        hint: result.error_hint,
        table: result.error_table,
        column: result.error_column,
        constraint: result.error_constraint,
        client_visible: result.client_visible_after_insert,
      };
    }

    // Check visibility assertion
    if (!result.client_visible_after_insert) {
      throw {
        stage: 'client_visibility_check',
        debugPayload,
        message: 'Client row not visible after INSERT',
      };
    }

    // Success
    return {
      client: { id: result.inserted_client_id },
      matter: { id: result.inserted_matter_id },
      debugPayload,
    };
  };

  const handlePasteSubmit = async () => {
    // REQUIRED: Explicit legal name input - intake text must NEVER influence client name
    if (!legalName.trim()) {
      toast.error('Client name is required');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setShowErrorDetails(false);

    // Always collect auth diagnostics for the technical details panel
    const who = await runWhoami();

    try {
      // Client creation ONLY - no timeline parsing during onboarding
      // Timeline events are added via ChatGPT Import on the client page
      const result = await createClientAndMatter(
        legalName.trim(),
        intakeText.trim() || null,
        'Narrative / ChatGPT'
      );

      if (result && result.client.id) {
        toast.success('Client created. Use ChatGPT Import to add timeline events.');
        resetForm();
        onOpenChange(false);
        onSuccess?.();
        // Navigate to client page (the main operator console)
        navigate(`/clients/${result.client.id}`);
      }
    } catch (error) {
      const anyErr = error as any;
      const stage = anyErr?.stage;
      const friendly =
        stage === 'rpc_call'
          ? 'Nothing saved: RPC call failed.'
          : stage === 'rpc_insert'
            ? 'Nothing saved: RPC insert failed (RLS or constraint).'
            : stage === 'transaction'
              ? 'Nothing saved: create transaction failed.'
              : stage === 'client'
                ? 'Nothing saved: client creation failed.'
                : stage === 'rollback'
                  ? 'Client saved but matter failed (and cleanup failed).'
                  : 'Nothing saved: matter creation failed.';

      // Include debugPayload if available
      const debugPayload = anyErr?.debugPayload ?? '';
      const technical = [
        'DEBUG RPC PAYLOAD:',
        debugPayload,
        '---',
        'ERROR DETAILS:',
        buildTechnicalError(error),
        '---',
        'WHOAMI (preflight):',
        who.text ?? lastWhoamiSnapshot,
      ]
        .filter(Boolean)
        .join('\n');

      setSubmitError({ friendly, technical });
      toast.error('Creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!legalName.trim()) {
      toast.error('Legal name is required');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setShowErrorDetails(false);

    // Always collect auth diagnostics for the technical details panel
    const who = await runWhoami();

    try {
      const result = await createClientAndMatter(
        legalName.trim(),
        null,
        'Manual',
        issueNote.trim() || undefined
      );

      if (result) {
        toast.success('Client created');
        resetForm();
        onOpenChange(false);
        onSuccess?.();
        // Navigate to client page (the main operator console)
        navigate(`/clients/${result.client.id}`);
      }
    } catch (error) {
      const anyErr = error as any;
      const stage = anyErr?.stage;
      const friendly =
        stage === 'rpc_call'
          ? 'Nothing saved: RPC call failed.'
          : stage === 'rpc_insert'
            ? 'Nothing saved: RPC insert failed (RLS or constraint).'
            : stage === 'transaction'
              ? 'Nothing saved: create transaction failed.'
              : stage === 'client'
                ? 'Nothing saved: client creation failed.'
                : stage === 'rollback'
                  ? 'Client saved but matter failed (and cleanup failed).'
                  : 'Nothing saved: matter creation failed.';

      // Include debugPayload if available
      const debugPayload = anyErr?.debugPayload ?? '';
      const technical = [
        'DEBUG RPC PAYLOAD:',
        debugPayload,
        '---',
        'ERROR DETAILS:',
        buildTechnicalError(error),
        '---',
        'WHOAMI (preflight):',
        who.text ?? lastWhoamiSnapshot,
      ]
        .filter(Boolean)
        .join('\n');

      setSubmitError({ friendly, technical });
      toast.error('Creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle keyboard shortcut: Cmd/Ctrl + Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'paste') {
        handlePasteSubmit();
      } else {
        handleManualSubmit();
      }
    }
  };

  const ErrorDisplay = () => {
    if (!submitError) return null;
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Couldn't create client</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{submitError.friendly}</p>
          {submitError.technical && (
            <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2">
                  <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showErrorDetails ? 'rotate-180' : ''}`} />
                  {showErrorDetails ? 'Hide technical details' : 'Show technical details'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Textarea
                  readOnly
                  value={submitError.technical}
                  className="min-h-[120px] font-mono text-xs bg-muted"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <p className="text-xs text-muted-foreground mt-1">Click to select, then copy</p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-card" onKeyDown={handleKeyDown}>
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl">Add Client</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'paste' | 'manual')} className="mt-2">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="paste" className="flex items-center gap-1.5 text-sm data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste Intake
              <span className="text-[10px] opacity-70">(Recommended)</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 text-sm text-muted-foreground data-[state=active]:text-foreground">
              <UserPlus className="h-3.5 w-3.5" />
              Quick Manual
            </TabsTrigger>
          </TabsList>

          {/* ===== PASTE INTAKE MODE (PRIMARY) ===== */}
          <TabsContent value="paste" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="paste-legal-name" className="text-sm font-medium">
                Client Legal Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="paste-legal-name"
                placeholder="Full legal name (required)"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intake-text" className="text-sm font-medium">
                Intake Text (optional)
              </Label>
              <Textarea
                ref={textareaRef}
                id="intake-text"
                placeholder="Paste structured narrative intake here (optional)...

This text will be stored verbatim. Use ChatGPT Import after creation to add timeline events."
                value={intakeText}
                onChange={(e) => setIntakeText(e.target.value)}
                className="min-h-[200px] font-mono text-sm leading-relaxed resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Intake text is stored but not parsed. Use ChatGPT Import on the client page to add timeline events.
              </p>
            </div>

            <Alert className="mt-2">
              <AlertTitle>Auth diagnostics (whoami)</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-mono">{whoamiStatus}</span>
                </p>
                {(whoamiStatus !== 'authenticated' || whoamiLoading) && (
                  <Alert variant="destructive">
                    <AlertTitle>Not authenticated — cannot create matters</AlertTitle>
                    <AlertDescription>
                      {whoamiLoading
                        ? 'Checking authentication…'
                        : 'Please log in, then reopen this dialog.'}
                    </AlertDescription>
                  </Alert>
                )}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">Technical details (whoami)</Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <Textarea
                      readOnly
                      value={whoamiText}
                      className="min-h-[120px] font-mono text-xs bg-muted"
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={runRlsTest}
                      disabled={isSubmitting || whoamiStatus !== 'authenticated'}
                    >
                      Run RLS Test (debug)
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </AlertDescription>
            </Alert>

            <ErrorDisplay />

            <Button 
              onClick={handlePasteSubmit} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base"
              disabled={isSubmitting || !legalName.trim() || whoamiStatus !== 'authenticated' || whoamiLoading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Client'
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Press ⌘+Enter to submit
            </p>
          </TabsContent>

          {/* ===== QUICK MANUAL ADD MODE (FALLBACK) ===== */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="legal-name">Legal Name *</Label>
              <Input
                id="legal-name"
                placeholder="Full legal name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                autoFocus={mode === 'manual'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="matter-type">Matter Type</Label>
              <Select value={matterType} onValueChange={(v) => setMatterType(v as MatterType)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-note">Note (optional)</Label>
              <Input
                id="issue-note"
                placeholder="One-line issue description"
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
              />
            </div>

            <ErrorDisplay />

            <Alert className="mt-2">
              <AlertTitle>Auth diagnostics (whoami)</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-mono">{whoamiStatus}</span>
                </p>
                {(whoamiStatus !== 'authenticated' || whoamiLoading) && (
                  <Alert variant="destructive">
                    <AlertTitle>Not authenticated — cannot create matters</AlertTitle>
                    <AlertDescription>
                      {whoamiLoading
                        ? 'Checking authentication…'
                        : 'Please log in, then reopen this dialog.'}
                    </AlertDescription>
                  </Alert>
                )}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">Technical details (whoami)</Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <Textarea
                      readOnly
                      value={whoamiText}
                      className="min-h-[120px] font-mono text-xs bg-muted"
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleManualSubmit} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base"
              disabled={isSubmitting || !legalName.trim() || whoamiStatus !== 'authenticated' || whoamiLoading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Client'
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Press ⌘+Enter to submit
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
