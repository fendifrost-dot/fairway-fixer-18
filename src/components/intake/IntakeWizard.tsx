import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateClient, useCreateMatter } from '@/hooks/useMutations';
import { useClients } from '@/hooks/useDashboardData';
import { MatterType } from '@/types/database';
import { toast } from 'sonner';
import { Loader2, ArrowRight, ArrowLeft, UserPlus, FolderPlus } from 'lucide-react';
import { z } from 'zod';

interface IntakeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const clientSchema = z.object({
  legal_name: z.string().min(1, 'Legal name is required').max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
});

export function IntakeWizard({ open, onOpenChange }: IntakeWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [useExistingClient, setUseExistingClient] = useState(false);
  
  // Client form state
  const [legalName, setLegalName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  
  // Matter form state
  const [matterType, setMatterType] = useState<MatterType>('Credit');
  const [matterTitle, setMatterTitle] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Federal (FCRA)');
  const [identityTheft, setIdentityTheft] = useState(false);
  const [mixedFile, setMixedFile] = useState(false);
  const [includeInnovis, setIncludeInnovis] = useState(false);
  const [includeLexis, setIncludeLexis] = useState(false);
  const [includeCorelogic, setIncludeCorelogic] = useState(false);
  const [includeSagestream, setIncludeSagestream] = useState(false);

  const { data: clients = [] } = useClients();
  const createClient = useCreateClient();
  const createMatter = useCreateMatter();

  const resetForm = () => {
    setStep(1);
    setUseExistingClient(false);
    setLegalName('');
    setPreferredName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setSelectedClientId('');
    setMatterType('Credit');
    setMatterTitle('');
    setJurisdiction('Federal (FCRA)');
    setIdentityTheft(false);
    setMixedFile(false);
    setIncludeInnovis(false);
    setIncludeLexis(false);
    setIncludeCorelogic(false);
    setIncludeSagestream(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleStep1Submit = async () => {
    if (useExistingClient) {
      if (!selectedClientId) {
        toast.error('Please select a client');
        return;
      }
      setStep(2);
      return;
    }

    const result = clientSchema.safeParse({ legal_name: legalName, email, phone });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    try {
      const client = await createClient.mutateAsync({
        legal_name: legalName,
        preferred_name: preferredName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      });
      setSelectedClientId(client.id);
      setStep(2);
      toast.success('Client created');
    } catch (error) {
      toast.error('Failed to create client');
    }
  };

  const handleStep2Submit = async () => {
    if (!matterTitle.trim()) {
      toast.error('Matter title is required');
      return;
    }

    try {
      await createMatter.mutateAsync({
        client_id: selectedClientId,
        matter_type: matterType,
        title: matterTitle,
        jurisdiction,
        identity_theft: identityTheft,
        mixed_file: mixedFile,
        include_innovis: includeInnovis,
        include_lexis: includeLexis,
        include_corelogic: includeCorelogic,
        include_sagestream: includeSagestream,
      });
      toast.success('Matter created with entity cases');
      handleClose();
    } catch (error) {
      toast.error('Failed to create matter');
    }
  };

  const isLoading = createClient.isPending || createMatter.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <UserPlus className="h-5 w-5" />
                Step 1: Client
              </>
            ) : (
              <>
                <FolderPlus className="h-5 w-5" />
                Step 2: Matter
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Create a new client or select an existing one'
              : 'Create a matter for this client'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Use existing client?</Label>
              <Switch
                checked={useExistingClient}
                onCheckedChange={setUseExistingClient}
              />
            </div>

            {useExistingClient ? (
              <div className="space-y-2">
                <Label>Select Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Name *</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Full legal name"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredName">Preferred Name</Label>
                  <Input
                    id="preferredName"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="Nickname or preferred name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Initial notes about the client..."
                    rows={2}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={handleStep1Submit} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Matter Type</Label>
              <Select value={matterType} onValueChange={(v) => setMatterType(v as MatterType)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="matterTitle">Matter Title *</Label>
              <Input
                id="matterTitle"
                value={matterTitle}
                onChange={(e) => setMatterTitle(e.target.value)}
                placeholder="e.g., Identity Theft - All Bureaus"
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setMatterTitle('Identity Theft - All Bureaus')}
                >
                  Identity Theft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setMatterTitle('Mixed File Dispute')}
                >
                  Mixed File
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setMatterTitle('Full Dispute - All Bureaus')}
                >
                  Full Dispute
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Federal (FCRA)">Federal (FCRA)</SelectItem>
                  <SelectItem value="California">California</SelectItem>
                  <SelectItem value="New York">New York</SelectItem>
                  <SelectItem value="Texas">Texas</SelectItem>
                  <SelectItem value="Florida">Florida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(matterType === 'Credit' || matterType === 'Both') && (
              <>
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-medium">Overlays (if known)</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Identity Theft Documented</span>
                    <Switch checked={identityTheft} onCheckedChange={setIdentityTheft} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mixed File Suspected</span>
                    <Switch checked={mixedFile} onCheckedChange={setMixedFile} />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-medium">Additional Entities</Label>
                  <p className="text-xs text-muted-foreground">
                    Experian, TransUnion, Equifax are auto-added for credit matters.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Innovis</span>
                      <Switch checked={includeInnovis} onCheckedChange={setIncludeInnovis} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">LexisNexis</span>
                      <Switch checked={includeLexis} onCheckedChange={setIncludeLexis} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">CoreLogic</span>
                      <Switch checked={includeCorelogic} onCheckedChange={setIncludeCorelogic} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">SageStream</span>
                      <Switch checked={includeSagestream} onCheckedChange={setIncludeSagestream} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleStep2Submit} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Matter
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
