import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileEdit, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DraftsSectionProps {
  clientId: string;
}

/**
 * Drafts Section - Placeholder for unsent documents
 * 
 * This section will contain:
 * - Drafted dispute letters (not yet sent)
 * - Drafted complaints (CFPB, BBB, AG)
 * - Drafted FTC narratives
 * - Intent-to-sue letters
 * 
 * These are NOT timeline events - they represent work-in-progress
 * that has not yet resulted in a real-world action.
 */
export function DraftsSection({ clientId }: DraftsSectionProps) {
  // TODO: Implement drafts storage and CRUD
  // For now, show a placeholder indicating this feature is coming
  
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <FileEdit className="h-4 w-4" />
            Drafts (Not Sent)
          </CardTitle>
          <Button variant="ghost" size="sm" disabled className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Add Draft
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-4">
          Drafts feature coming soon. This will store dispute letters and complaints 
          that have been prepared but not yet sent.
        </p>
      </CardContent>
    </Card>
  );
}
