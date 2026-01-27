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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardPaste, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type MatterType = Database['public']['Enums']['matter_type'];
type EntityType = Database['public']['Enums']['entity_type'];

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Standard CRAs - always created
const STANDARD_CRAS = [
  { name: 'Experian', type: 'CRA' as EntityType },
  { name: 'TransUnion', type: 'CRA' as EntityType },
  { name: 'Equifax', type: 'CRA' as EntityType },
];

// Optional entities - OFF by default
const OPTIONAL_ENTITIES = [
  { key: 'innovis', name: 'Innovis', type: 'CRA' as EntityType },
  { key: 'lexisnexis', name: 'LexisNexis', type: 'DataBroker' as EntityType },
  { key: 'corelogic', name: 'CoreLogic Teletrack', type: 'DataBroker' as EntityType },
  { key: 'sagestream', name: 'SageStream', type: 'CRA' as EntityType },
];

export function AddClientDialog({ open, onOpenChange, onSuccess }: AddClientDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'paste' | 'manual'>('paste');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Paste intake state
  const [intakeText, setIntakeText] = useState('');

  // Quick manual state
  const [legalName, setLegalName] = useState('');
  const [matterType, setMatterType] = useState<MatterType>('Credit');
  const [issueNote, setIssueNote] = useState('');

  // Optional entities (all OFF by default)
  const [optionalEntities, setOptionalEntities] = useState<Record<string, boolean>>({
    innovis: false,
    lexisnexis: false,
    corelogic: false,
    sagestream: false,
  });

  // Overlay suggestions (OFF by default, soft suggestion only)
  const [overlays, setOverlays] = useState({
    identityTheft: false,
    mixedFile: false,
  });
  const [overlaysDetected, setOverlaysDetected] = useState(false);

  // Auto-focus textarea when dialog opens in paste mode
  useEffect(() => {
    if (open && mode === 'paste') {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, mode]);

  const resetForm = () => {
    setIntakeText('');
    setLegalName('');
    setMatterType('Credit');
    setIssueNote('');
    setOptionalEntities({
      innovis: false,
      lexisnexis: false,
      corelogic: false,
      sagestream: false,
    });
    setOverlays({ identityTheft: false, mixedFile: false });
    setOverlaysDetected(false);
    setMode('paste');
  };

  // Best-effort name parsing (never blocks creation)
  const parseNameFromIntake = (text: string): string | null => {
    const patterns = [
      /(?:client|name|legal name|full name|consumer)\s*[:\-]\s*([^\n,]+)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:\s+[A-Z][a-z]+)+)/m,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        return match[1].trim().substring(0, 100);
      }
    }
    return null;
  };

  // Best-effort overlay detection (soft suggestion only)
  const detectOverlays = (text: string) => {
    const lowerText = text.toLowerCase();
    const hasIdentityTheft = /identity\s*theft|id\s*theft|ftc\s*report|fraud\s*alert|fraudulent\s*account|stolen\s*identity/i.test(lowerText);
    const hasMixedFile = /mixed\s*file|wrong\s*person|another\s*consumer|shares?\s*name|mistaken\s*identity|not\s*my\s*account/i.test(lowerText);
    
    return { identityTheft: hasIdentityTheft, mixedFile: hasMixedFile };
  };

  const handleIntakeTextChange = (text: string) => {
    setIntakeText(text);
    // Best-effort overlay detection (non-blocking, soft suggestion)
    if (text.length > 50) {
      const detected = detectOverlays(text);
      if (detected.identityTheft || detected.mixedFile) {
        setOverlaysDetected(true);
        setOverlays(detected);
      }
    }
  };

  const createClientAndMatter = async (clientName: string, rawIntakeText: string | null, source: string, noteText?: string) => {
    if (!user) {
      toast.error('You must be logged in');
      return null;
    }

    try {
      // 1. Create Client (always succeeds, name can be edited later)
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          legal_name: clientName || 'New Client',
          owner_id: user.id,
          status: 'Active',
          notes: noteText || null,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // 2. Create Matter with intake fields (defaults: Credit, Federal FCRA, Dispute Preparation)
      const { data: matter, error: matterError } = await supabase
        .from('matters')
        .insert({
          client_id: client.id,
          title: clientName ? `${clientName} - Credit Matter` : 'New Credit Matter',
          matter_type: matterType,
          jurisdiction: 'Federal (FCRA)',
          primary_state: 'DisputePreparation',
          intake_raw_text: rawIntakeText,
          intake_source: source,
          intake_created_at: rawIntakeText ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (matterError) throw matterError;

      // 3. Create Entity Cases (standard + optional)
      const entitiesToCreate = [
        ...STANDARD_CRAS,
        ...OPTIONAL_ENTITIES.filter(e => optionalEntities[e.key]),
      ];

      const entityCasesData = entitiesToCreate.map(entity => ({
        matter_id: matter.id,
        entity_name: entity.name,
        entity_type: entity.type,
        state: 'DisputePreparation' as const,
      }));

      await supabase.from('entity_cases').insert(entityCasesData);

      // 4. Create Overlays if user confirmed
      const overlaysToCreate = [];
      if (overlays.identityTheft) {
        overlaysToCreate.push({
          matter_id: matter.id,
          overlay_type: 'IdentityTheftDocumented' as const,
          is_active: true,
        });
      }
      if (overlays.mixedFile) {
        overlaysToCreate.push({
          matter_id: matter.id,
          overlay_type: 'MixedFileConfirmed' as const,
          is_active: true,
        });
      }

      if (overlaysToCreate.length > 0) {
        await supabase.from('overlays').insert(overlaysToCreate);
      }

      return { client, matter };
    } catch (error) {
      console.error('Creation error:', error);
      throw error;
    }
  };

  const handlePasteSubmit = async () => {
    // Never reject - if empty, still allow (user can paste nothing and fix later)
    setIsSubmitting(true);
    try {
      const parsedName = intakeText.trim() ? parseNameFromIntake(intakeText) : null;
      const result = await createClientAndMatter(
        parsedName || 'New Client',
        intakeText.trim() || null,
        'Narrative / ChatGPT'
      );

      if (result) {
        toast.success('Client created');
        resetForm();
        onOpenChange(false);
        onSuccess?.();
        // Navigate to matter detail (preferred per directive)
        navigate(`/matters/${result.matter.id}`);
      }
    } catch (error) {
      toast.error('Creation failed. Please try again.');
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
    try {
      const result = await createClientAndMatter(legalName.trim(), null, 'Manual', issueNote.trim() || undefined);

      if (result) {
        toast.success('Client created');
        resetForm();
        onOpenChange(false);
        onSuccess?.();
        navigate(`/matters/${result.matter.id}`);
      }
    } catch (error) {
      toast.error('Creation failed. Please try again.');
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
            {/* DOMINANT TEXTAREA */}
            <div className="space-y-2">
              <Label htmlFor="intake-text" className="text-sm font-medium">
                Paste client intake from ChatGPT or structured notes
              </Label>
              <Textarea
                ref={textareaRef}
                id="intake-text"
                placeholder="Paste structured narrative intake here...

Example:
Client: John Smith
Issue: Identity theft — fraudulent accounts on all three bureaus
FTC Report: Filed 01/15/2025
Disputed Accounts:
- Capital One ($5,000) — not mine
- Chase ($12,000) — not mine
- Wells Fargo ($3,200) — not mine

Strategy: Full dispute cycle, escalate to CFPB if boilerplate..."
                value={intakeText}
                onChange={(e) => handleIntakeTextChange(e.target.value)}
                className="min-h-[280px] font-mono text-sm leading-relaxed resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Paste structured narrative intake. This will be stored verbatim and used to initialize the case.
              </p>
            </div>

            {/* Overlay Suggestions (soft, non-blocking) */}
            {overlaysDetected && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-2">
                <p className="text-xs font-medium text-accent">Suggested Overlays (detected from intake)</p>
                <div className="flex flex-wrap gap-4">
                  {overlays.identityTheft && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="id-theft"
                        checked={overlays.identityTheft}
                        onCheckedChange={(checked) => 
                          setOverlays(prev => ({ ...prev, identityTheft: !!checked }))
                        }
                      />
                      <Label htmlFor="id-theft" className="text-xs cursor-pointer">Identity Theft</Label>
                    </div>
                  )}
                  {overlays.mixedFile && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mixed-file"
                        checked={overlays.mixedFile}
                        onCheckedChange={(checked) => 
                          setOverlays(prev => ({ ...prev, mixedFile: !!checked }))
                        }
                      />
                      <Label htmlFor="mixed-file" className="text-xs cursor-pointer">Mixed File</Label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Optional Entities (compact, collapsed feel) */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Auto-included:</span> Experian, TransUnion, Equifax
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {OPTIONAL_ENTITIES.map(entity => (
                  <div key={entity.key} className="flex items-center gap-1.5">
                    <Checkbox
                      id={entity.key}
                      checked={optionalEntities[entity.key]}
                      onCheckedChange={(checked) => 
                        setOptionalEntities(prev => ({ ...prev, [entity.key]: !!checked }))
                      }
                      className="h-3.5 w-3.5"
                    />
                    <Label htmlFor={entity.key} className="text-xs text-muted-foreground cursor-pointer">{entity.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handlePasteSubmit} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base"
              disabled={isSubmitting}
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

            {/* Optional entities for manual mode */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Auto-included:</span> Experian, TransUnion, Equifax
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {OPTIONAL_ENTITIES.map(entity => (
                  <div key={entity.key} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`manual-${entity.key}`}
                      checked={optionalEntities[entity.key]}
                      onCheckedChange={(checked) => 
                        setOptionalEntities(prev => ({ ...prev, [entity.key]: !!checked }))
                      }
                      className="h-3.5 w-3.5"
                    />
                    <Label htmlFor={`manual-${entity.key}`} className="text-xs text-muted-foreground cursor-pointer">{entity.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleManualSubmit} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base"
              disabled={isSubmitting || !legalName.trim()}
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
