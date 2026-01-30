import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { DbClient } from '@/types/database';
import { ArrowLeft, Loader2, FileDown } from 'lucide-react';
import { ClientHeader } from '@/components/operator/ClientHeader';
import { ChatGPTImport } from '@/components/operator/ChatGPTImport';
import { Timeline } from '@/components/operator/Timeline';
import { Recommendations } from '@/components/operator/Recommendations';
import { TaskList } from '@/components/operator/TaskList';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import { useOperatorTasks } from '@/hooks/useOperatorTasks';
import { generateRecommendations } from '@/lib/recommendationEngine';
import { downloadPDF } from '@/lib/pdfExport';

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();

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
  
  const recommendations = generateRecommendations(events);

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
    <div className="space-y-6 animate-fade-in">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        
        <Button onClick={handleGeneratePDF} variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-1" />
          Generate Client Status Report (PDF)
        </Button>
      </div>

      {/* Client Header */}
      <ClientHeader client={client} />

      {/* ChatGPT Import */}
      <ChatGPTImport clientId={clientId!} />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Timeline - takes 2 columns */}
        <div className="lg:col-span-2">
          <Timeline events={events} clientId={clientId!} />
        </div>
        
        {/* Right sidebar - Recommendations and Tasks */}
        <div className="space-y-6">
          <Recommendations recommendations={recommendations} clientId={clientId!} />
          <TaskList tasks={tasks} clientId={clientId!} />
        </div>
      </div>
    </div>
  );
}
