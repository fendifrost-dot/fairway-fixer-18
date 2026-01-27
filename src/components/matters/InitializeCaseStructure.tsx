import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type EntityType = Database['public']['Enums']['entity_type'];
type OverlayType = Database['public']['Enums']['overlay_type'];

interface InitializeCaseStructureProps {
  matterId: string;
  existingEntityNames: string[];
  existingOverlayTypes: string[];
}

// Standard CRAs - always created
const STANDARD_CRAS: { name: string; type: EntityType }[] = [
  { name: 'Experian', type: 'CRA' },
  { name: 'TransUnion', type: 'CRA' },
  { name: 'Equifax', type: 'CRA' },
];

// Optional entities
const OPTIONAL_ENTITIES: { key: string; name: string; type: EntityType }[] = [
  { key: 'innovis', name: 'Innovis', type: 'CRA' },
  { key: 'lexisnexis', name: 'LexisNexis', type: 'DataBroker' },
  { key: 'corelogic', name: 'CoreLogic Teletrack', type: 'DataBroker' },
  { key: 'sagestream', name: 'SageStream', type: 'CRA' },
];

// Available overlays
const AVAILABLE_OVERLAYS: { key: string; label: string; type: OverlayType }[] = [
  { key: 'identityTheft', label: 'Identity Theft', type: 'IdentityTheftDocumented' },
  { key: 'mixedFile', label: 'Mixed File', type: 'MixedFileConfirmed' },
];

export function InitializeCaseStructure({
  matterId,
  existingEntityNames,
  existingOverlayTypes,
}: InitializeCaseStructureProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Optional entity selections (standard CRAs are always included)
  const [selectedOptional, setSelectedOptional] = useState<Record<string, boolean>>({
    innovis: false,
    lexisnexis: false,
    corelogic: false,
    sagestream: false,
  });
  
  // Overlay selections
  const [selectedOverlays, setSelectedOverlays] = useState<Record<string, boolean>>({
    identityTheft: false,
    mixedFile: false,
  });

  // Determine what's already initialized
  const standardCrasInitialized = STANDARD_CRAS.every(cra => 
    existingEntityNames.includes(cra.name)
  );
  
  const isFullyInitialized = standardCrasInitialized;

  // Calculate what will be created
  const entitiesToCreate = [
    ...STANDARD_CRAS.filter(cra => !existingEntityNames.includes(cra.name)),
    ...OPTIONAL_ENTITIES.filter(e => selectedOptional[e.key] && !existingEntityNames.includes(e.name)),
  ];

  const overlaysToCreate = AVAILABLE_OVERLAYS.filter(
    o => selectedOverlays[o.key] && !existingOverlayTypes.includes(o.type)
  );

  const handleInitialize = async () => {
    if (entitiesToCreate.length === 0 && overlaysToCreate.length === 0) {
      toast.info('Nothing new to initialize');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create entity cases (idempotent - skip existing)
      if (entitiesToCreate.length > 0) {
        const entityData = entitiesToCreate.map(entity => ({
          matter_id: matterId,
          entity_name: entity.name,
          entity_type: entity.type,
          state: 'DisputePreparation' as const,
        }));

        const { error: entityError } = await supabase
          .from('entity_cases')
          .insert(entityData);

        if (entityError) throw entityError;
      }

      // Create overlays (idempotent - skip existing)
      if (overlaysToCreate.length > 0) {
        const overlayData = overlaysToCreate.map(overlay => ({
          matter_id: matterId,
          overlay_type: overlay.type,
          is_active: true,
        }));

        const { error: overlayError } = await supabase
          .from('overlays')
          .insert(overlayData);

        if (overlayError) throw overlayError;
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['matterEntityCases', matterId] });
      await queryClient.invalidateQueries({ queryKey: ['matter', matterId] });

      toast.success('Case structure initialized');
    } catch (error) {
      console.error('Initialization error:', error);
      toast.error('Failed to initialize case structure');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already fully initialized with standard CRAs, show success state
  if (isFullyInitialized) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">Case Structure Initialized</CardTitle>
          </div>
          <CardDescription>
            Standard entity cases (Experian, TransUnion, Equifax) are active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Show existing entities */}
            <div className="flex flex-wrap gap-2">
              {existingEntityNames.map(name => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>

            {/* Allow adding more optional entities */}
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Add optional entities:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {OPTIONAL_ENTITIES.filter(e => !existingEntityNames.includes(e.name)).map(entity => (
                  <div key={entity.key} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`add-${entity.key}`}
                      checked={selectedOptional[entity.key]}
                      onCheckedChange={(checked) =>
                        setSelectedOptional(prev => ({ ...prev, [entity.key]: !!checked }))
                      }
                      className="h-3.5 w-3.5"
                    />
                    <Label htmlFor={`add-${entity.key}`} className="text-xs cursor-pointer">
                      {entity.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Overlays */}
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Overlays:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {AVAILABLE_OVERLAYS.map(overlay => {
                  const alreadyExists = existingOverlayTypes.includes(overlay.type);
                  return (
                    <div key={overlay.key} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`overlay-${overlay.key}`}
                        checked={alreadyExists || selectedOverlays[overlay.key]}
                        disabled={alreadyExists}
                        onCheckedChange={(checked) =>
                          setSelectedOverlays(prev => ({ ...prev, [overlay.key]: !!checked }))
                        }
                        className="h-3.5 w-3.5"
                      />
                      <Label 
                        htmlFor={`overlay-${overlay.key}`} 
                        className={`text-xs cursor-pointer ${alreadyExists ? 'text-muted-foreground' : ''}`}
                      >
                        {overlay.label} {alreadyExists && '(active)'}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add more button */}
            {(entitiesToCreate.length > 0 || overlaysToCreate.length > 0) && (
              <Button
                onClick={handleInitialize}
                disabled={isSubmitting}
                size="sm"
                className="mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  `Add ${entitiesToCreate.length + overlaysToCreate.length} item(s)`
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not initialized - show initialization UI
  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-accent" />
          <CardTitle className="text-lg">Initialize Case Structure</CardTitle>
        </div>
        <CardDescription>
          Set up entity cases and overlays for this matter. This is required before logging actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Standard entities (always included) */}
        <div>
          <p className="text-sm font-medium mb-2">Standard CRAs (always included):</p>
          <div className="flex flex-wrap gap-2">
            {STANDARD_CRAS.map(cra => (
              <Badge key={cra.name} variant="outline" className="text-xs">
                {cra.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Optional entities */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-sm font-medium mb-2">Optional entities:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {OPTIONAL_ENTITIES.map(entity => (
              <div key={entity.key} className="flex items-center gap-1.5">
                <Checkbox
                  id={entity.key}
                  checked={selectedOptional[entity.key]}
                  onCheckedChange={(checked) =>
                    setSelectedOptional(prev => ({ ...prev, [entity.key]: !!checked }))
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor={entity.key} className="text-sm cursor-pointer">
                  {entity.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Overlays */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-sm font-medium mb-2">Overlays (optional):</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {AVAILABLE_OVERLAYS.map(overlay => (
              <div key={overlay.key} className="flex items-center gap-1.5">
                <Checkbox
                  id={`overlay-init-${overlay.key}`}
                  checked={selectedOverlays[overlay.key]}
                  onCheckedChange={(checked) =>
                    setSelectedOverlays(prev => ({ ...prev, [overlay.key]: !!checked }))
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor={`overlay-init-${overlay.key}`} className="text-sm cursor-pointer">
                  {overlay.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Initialize button */}
        <Button
          onClick={handleInitialize}
          disabled={isSubmitting}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-10"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Initializing...
            </>
          ) : (
            'Initialize Case Structure'
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Safe to retry — won't create duplicates
        </p>
      </CardContent>
    </Card>
  );
}
