import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

// Standard CRAs that are always created
const STANDARD_CRAS = [
  { name: 'Experian', type: 'CRA' as EntityType },
  { name: 'TransUnion', type: 'CRA' as EntityType },
  { name: 'Equifax', type: 'CRA' as EntityType },
];

// Optional entities user can toggle
const OPTIONAL_ENTITIES = [
  { key: 'innovis', name: 'Innovis', type: 'CRA' as EntityType },
  { key: 'lexisnexis', name: 'LexisNexis', type: 'DataBroker' as EntityType },
  { key: 'corelogic', name: 'CoreLogic Teletrack', type: 'DataBroker' as EntityType },
  { key: 'sagestream', name: 'SageStream', type: 'CRA' as EntityType },
];

export function AddClientDialog({ open, onOpenChange, onSuccess }: AddClientDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'paste' | 'manual'>('paste');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Paste intake state
  const [intakeText, setIntakeText] = useState('');

  // Quick manual state
  const [legalName, setLegalName] = useState('');
  const [matterType, setMatterType] = useState<MatterType>('Credit');
  const [issueNote, setIssueNote] = useState('');

  // Optional entities toggles (all unchecked by default)
  const [optionalEntities, setOptionalEntities] = useState<Record<string, boolean>>({
    innovis: false,
    lexisnexis: false,
    corelogic: false,
    sagestream: false,
  });

  // Overlay suggestions (off by default, can be toggled)
  const [overlays, setOverlays] = useState({
    identityTheft: false,
    mixedFile: false,
  });

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
  };

  // Best-effort parsing for legal name from intake text
  const parseNameFromIntake = (text: string): string | null => {
    // Look for common patterns like "Client: Name" or "Name: John Doe"
    const patterns = [
      /(?:client|name|legal name|full name)\s*[:\-]\s*([^\n,]+)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m, // Capitalized name at start of line
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  // Best-effort overlay detection
  const detectOverlays = (text: string) => {
    const lowerText = text.toLowerCase();
    const hasIdentityTheft = /identity\s*theft|id\s*theft|ftc\s*report|fraud\s*alert|fraudulent\s*account/i.test(lowerText);
    const hasMixedFile = /mixed\s*file|wrong\s*person|another\s*consumer|shares?\s*name|mistaken\s*identity/i.test(lowerText);
    
    return { identityTheft: hasIdentityTheft, mixedFile: hasMixedFile };
  };

  const handleIntakeTextChange = (text: string) => {
    setIntakeText(text);
    // Best-effort overlay detection (non-blocking)
    const detected = detectOverlays(text);
    setOverlays(detected);
  };

  const createClientAndMatter = async (clientName: string, rawIntakeText: string | null, source: string) => {
    if (!user) {
      toast.error('You must be logged in to add clients');
      return null;
    }

    // 1. Create Client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        legal_name: clientName || 'New Client',
        owner_id: user.id,
        status: 'Active',
        notes: issueNote || null,
      })
      .select()
      .single();

    if (clientError) {
      console.error('Client creation error:', clientError);
      throw new Error(`Failed to create client: ${clientError.message}`);
    }

    // 2. Create Matter with intake fields
    const { data: matter, error: matterError } = await supabase
      .from('matters')
      .insert({
        client_id: client.id,
        title: clientName ? `${clientName} - ${matterType} Matter` : `New ${matterType} Matter`,
        matter_type: matterType,
        jurisdiction: 'Federal (FCRA)',
        primary_state: 'DisputePreparation',
        intake_raw_text: rawIntakeText,
        intake_source: source,
        intake_created_at: rawIntakeText ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (matterError) {
      console.error('Matter creation error:', matterError);
      throw new Error(`Failed to create matter: ${matterError.message}`);
    }

    // 3. Create Entity Cases (standard CRAs + optional entities)
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

    if (entityCasesData.length > 0) {
      const { error: entityError } = await supabase
        .from('entity_cases')
        .insert(entityCasesData);

      if (entityError) {
        console.error('Entity case creation error:', entityError);
        // Non-blocking - log but continue
      }
    }

    // 4. Create Overlays if toggled on
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
      const { error: overlayError } = await supabase
        .from('overlays')
        .insert(overlaysToCreate);

      if (overlayError) {
        console.error('Overlay creation error:', overlayError);
        // Non-blocking - log but continue
      }
    }

    return { client, matter };
  };

  const handlePasteSubmit = async () => {
    if (!intakeText.trim()) {
      toast.error('Please paste intake text');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedName = parseNameFromIntake(intakeText);
      const result = await createClientAndMatter(
        parsedName || 'New Client',
        intakeText,
        'Narrative / ChatGPT'
      );

      if (result) {
        toast.success('Client and matter created successfully');
        resetForm();
        onOpenChange(false);
        onSuccess?.();
        navigate(`/clients/${result.client.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create client');
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
      const result = await createClientAndMatter(legalName, null, 'Manual');

      if (result) {
        toast.success('Client and matter created successfully');
        resetForm();
        onOpenChange(false);
        onSuccess?.();
        navigate(`/clients/${result.client.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Client</DialogTitle>
          <DialogDescription>
            Create a new client to activate the workflow engine.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'paste' | 'manual')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4" />
              Paste Intake
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Quick Manual Add
            </TabsTrigger>
          </TabsList>

          {/* Paste Intake Mode */}
          <TabsContent value="paste" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="intake-text">
                Paste Client Intake (from ChatGPT or structured notes)
              </Label>
              <Textarea
                id="intake-text"
                placeholder="Paste structured narrative intake. The system will configure the case automatically.

Example:
Client: John Smith
Issue: Identity theft - fraudulent accounts appearing on credit reports
Bureaus: All three - Experian, TransUnion, Equifax
FTC Report: Filed 01/15/2025
Disputed Accounts:
- Capital One - $5,000 (not mine)
- Chase - $12,000 (not mine)
..."
                value={intakeText}
                onChange={(e) => handleIntakeTextChange(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Paste structured narrative intake. The system will configure the case automatically.
              </p>
            </div>

            {/* Overlay Detection Suggestions */}
            {intakeText && (overlays.identityTheft || overlays.mixedFile) && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-2">
                <p className="text-sm font-medium text-accent">Detected Overlays (toggle as needed)</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="id-theft"
                      checked={overlays.identityTheft}
                      onCheckedChange={(checked) => 
                        setOverlays(prev => ({ ...prev, identityTheft: !!checked }))
                      }
                    />
                    <Label htmlFor="id-theft" className="text-sm">Identity Theft Documented</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mixed-file"
                      checked={overlays.mixedFile}
                      onCheckedChange={(checked) => 
                        setOverlays(prev => ({ ...prev, mixedFile: !!checked }))
                      }
                    />
                    <Label htmlFor="mixed-file" className="text-sm">Mixed File Confirmed</Label>
                  </div>
                </div>
              </div>
            )}

            {/* Optional Entities */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Additional Entities (optional)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Experian, TransUnion, and Equifax are added automatically.
              </p>
              <div className="flex flex-wrap gap-4">
                {OPTIONAL_ENTITIES.map(entity => (
                  <div key={entity.key} className="flex items-center gap-2">
                    <Checkbox
                      id={entity.key}
                      checked={optionalEntities[entity.key]}
                      onCheckedChange={(checked) => 
                        setOptionalEntities(prev => ({ ...prev, [entity.key]: !!checked }))
                      }
                    />
                    <Label htmlFor={entity.key} className="text-sm">{entity.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handlePasteSubmit} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={isSubmitting || !intakeText.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Client & Matter'
              )}
            </Button>
          </TabsContent>

          {/* Quick Manual Add Mode */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="legal-name">Legal Name *</Label>
              <Input
                id="legal-name"
                placeholder="Full legal name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="matter-type">Matter Type</Label>
              <Select value={matterType} onValueChange={(v) => setMatterType(v as MatterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-note">Issue Note (optional)</Label>
              <Input
                id="issue-note"
                placeholder="One-line issue description"
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
              />
            </div>

            {/* Optional Entities for manual mode too */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Additional Entities (optional)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Experian, TransUnion, and Equifax are added automatically.
              </p>
              <div className="flex flex-wrap gap-4">
                {OPTIONAL_ENTITIES.map(entity => (
                  <div key={entity.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`manual-${entity.key}`}
                      checked={optionalEntities[entity.key]}
                      onCheckedChange={(checked) => 
                        setOptionalEntities(prev => ({ ...prev, [entity.key]: !!checked }))
                      }
                    />
                    <Label htmlFor={`manual-${entity.key}`} className="text-sm">{entity.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Overlay toggles for manual mode */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Overlays (optional)</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="manual-id-theft"
                    checked={overlays.identityTheft}
                    onCheckedChange={(checked) => 
                      setOverlays(prev => ({ ...prev, identityTheft: !!checked }))
                    }
                  />
                  <Label htmlFor="manual-id-theft" className="text-sm">Identity Theft Documented</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="manual-mixed-file"
                    checked={overlays.mixedFile}
                    onCheckedChange={(checked) => 
                      setOverlays(prev => ({ ...prev, mixedFile: !!checked }))
                    }
                  />
                  <Label htmlFor="manual-mixed-file" className="text-sm">Mixed File Confirmed</Label>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleManualSubmit} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={isSubmitting || !legalName.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Client & Matter'
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
