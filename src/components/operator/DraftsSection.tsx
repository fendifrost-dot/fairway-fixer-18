import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileEdit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDrafts } from '@/hooks/useDrafts';
import { useDeleteTimelineEvent } from '@/hooks/useTimelineEvents';
import { TimelineEvent } from '@/types/operator';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface DraftsSectionProps {
  clientId: string;
}

function DraftItem({ draft, clientId }: { draft: TimelineEvent; clientId: string }) {
  const deleteEvent = useDeleteTimelineEvent();
  
  return (
    <div className="flex gap-3 group py-3 border-b last:border-b-0">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
        <FileEdit className="h-3 w-3 text-amber-600" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {draft.event_date && !draft.date_is_unknown
                  ? format(parseISO(draft.event_date), 'MMM d, yyyy')
                  : 'No date'}
              </span>
              {draft.source && (
                <Badge variant="outline" className="text-xs">
                  {draft.source}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                Draft
              </Badge>
            </div>
            <p className="font-medium text-sm">{draft.title}</p>
            <p className="text-sm text-muted-foreground">{draft.summary}</p>
            {draft.details && (
              <p className="text-xs text-muted-foreground mt-1">{draft.details}</p>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={() => deleteEvent.mutate({ id: draft.id, clientId })}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Drafts Section - Displays unsent documents
 * 
 * Renders all rows where: is_draft = true OR event_kind = 'draft'
 * 
 * These items are NEVER shown in:
 * - Evidence Timeline
 * - Notes section
 * - Any bureau/regulatory accordion
 */
export function DraftsSection({ clientId }: DraftsSectionProps) {
  const { data: drafts = [], isLoading } = useDrafts(clientId);

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <FileEdit className="h-4 w-4" />
            Drafts (Not Sent)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={drafts.length === 0 ? "border-dashed" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <FileEdit className="h-4 w-4" />
            Drafts (Not Sent)
            {drafts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {drafts.length}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No drafts. Documents will appear here once drafted but before sending.
          </p>
        ) : (
          <div className="divide-y-0">
            {drafts.map(draft => (
              <DraftItem key={draft.id} draft={draft} clientId={clientId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
