import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { DbClient } from '@/types/database';
import { ArrowLeft, Loader2, FileDown, Trash2 } from 'lucide-react';
import { ClientHeader } from '@/components/operator/ClientHeader';
import { ChatGPTImport } from '@/components/operator/ChatGPTImport';
import { EvidenceTimeline } from '@/components/operator/EvidenceTimeline/index';
import { NotesSection } from '@/components/operator/NotesSection';
import { ScheduledEvents } from '@/components/operator/ScheduledEvents/index';
import { UnresolvedStatePanel } from '@/components/operator/UnresolvedStatePanel';
import { BaselinePanel } from '@/components/baseline/BaselinePanel';
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog';
import { CreditScoresPanel } from '@/components/analyzer/CreditScoresPanel';
import { BureauNarrative } from '@/components/analyzer/BureauNarrative';
import { CreditAnalyzer } from '@/components/analyzer/CreditAnalyzer';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import { useOperatorTasks } from '@/hooks/useOperatorTasks';
import { downloadPDF } from '@/lib/pdfExport';
import { ParseResult, UnresolvedItem } from '@/types/parser';

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const [unresolvedItems, setUnresolvedItems] = useState<UnresolvedItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data as DbClient | null;
    },
    enabled: !!clientId,
  });

  const { data: events = [], isLoading: eventsLoading } = useTimelineEvents(clientId);
  const { data: tasks = [], isLoading: tasksLoading } = useOperatorTasks(clientId);

  const handleImportComplete = (result: ParseResult) => {
    if (result.unresolved_items.length > 0) {
      setUnresolvedItems(prev => [...prev, ...result.unresolved_items]);
    }
  };

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/clients">Back to Clients</Link>
        </Button>
      </div>
    );
  }

  const handleGeneratePDF = () => {
    downloadPDF(client, events, tasks);
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/clients">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={handleGeneratePDF} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              Generate PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Client
            </Button>
          </div>
        </div>

        {/* Client Header */}
        <ClientHeader client={client} />

        {/* Credit Scores */}
        <CreditScoresPanel clientId={clientId!} />

        {/* ChatGPT Import */}
        <ChatGPTImport clientId={clientId!} onImportComplete={handleImportComplete} />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Timeline + Bureau Narrative + Notes */}
          <div className="lg:col-span-2 space-y-6">
            <EvidenceTimeline events={events} clientId={clientId!} />
            <BureauNarrative clientId={clientId!} />
            <CreditAnalyzer clientId={clientId!} />
            <BaselinePanel clientId={clientId!} />
            <NotesSection clientId={clientId!} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {unresolvedItems.length > 0 && (
              <UnresolvedStatePanel items={unresolvedItems} />
            )}
            <ScheduledEvents
              tasks={tasks}
              clientId={clientId!}
              timelineEvents={events}
            />
          </div>
        </div>
      </div>

      <DeleteClientDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        clientId={clientId!}
        clientName={client.legal_name}
      />
    </>
  );
}
