import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ReinsertionAlert } from '@/components/dashboard/ReinsertionAlert';
import { StatePressureStrip } from '@/components/dashboard/StatePressureStrip';
import { TimeCriticalActions } from '@/components/dashboard/TimeCriticalActions';
import { MetricsSummary } from '@/components/dashboard/MetricsSummary';
import { ViolationAlerts } from '@/components/dashboard/ViolationAlerts';
import { ConsultingDashboard } from '@/components/dashboard/ConsultingDashboard';
import { GlobalFilterBar } from '@/components/dashboard/GlobalFilterBar';
import { DailyChecklist } from '@/components/dashboard/DailyChecklist';
import { LogActionDialog } from '@/components/logging/LogActionDialog';
import { LogResponseDialog } from '@/components/logging/LogResponseDialog';
import { BatchLoggingDialog } from '@/components/logging/BatchLoggingDialog';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { DashboardFilters, MatterState } from '@/types/database';
import { useClients } from '@/hooks/useClients';
import { Scale, Briefcase, Plus, FileText, MessageSquare, ListChecks, Layers, Users, Loader2 } from 'lucide-react';

const ACTIVE_STATES: MatterState[] = [
  'DisputeActive', 'PartialCompliance', 'ViolationConfirmed', 'ReinsertionDetected',
  'RegulatoryReview', 'FurnisherLiabilityTrack', 'EscalationEligible', 'LitigationReady',
];

export default function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    scope: 'all',
    matterType: 'Credit',
    states: ACTIVE_STATES,
    timeWindow: 'today',
  });
  
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [logActionOpen, setLogActionOpen] = useState(false);
  const [logResponseOpen, setLogResponseOpen] = useState(false);
  const [batchMode, setBatchMode] = useState<'action' | 'response' | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);

  const { data: clients, isLoading: clientsLoading, refetch: refetchClients } = useClients();

  // Legacy state filter for existing components
  const stateFilter = filters.states.length === 1 ? filters.states[0] : null;

  const hasNoClients = !clientsLoading && (!clients || clients.length === 0);

  // Empty state component
  const EmptyDashboard = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-accent/10 p-6 mb-6">
        <Users className="h-12 w-12 text-accent" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No clients yet</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Add your first client to activate the workflow engine.
      </p>
      <Button 
        onClick={() => setAddClientOpen(true)}
        className="bg-accent hover:bg-accent/90 text-accent-foreground"
        size="lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        Add Client
      </Button>
    </div>
  );

  // Loading state
  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Empty state - no clients at all
  if (hasNoClients) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Command Console</h1>
            <p className="text-muted-foreground mt-1">Statutory compliance and case management</p>
          </div>
        </div>

        <EmptyDashboard />

        <AddClientDialog 
          open={addClientOpen} 
          onOpenChange={setAddClientOpen}
          onSuccess={() => refetchClients()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Console</h1>
          <p className="text-muted-foreground mt-1">Statutory compliance and case management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowChecklist(!showChecklist)}>
            <ListChecks className="h-4 w-4 mr-1" />
            {showChecklist ? 'Hide Checklist' : 'Daily Checklist'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogActionOpen(true)}>
            <FileText className="h-4 w-4 mr-1" />
            Log Action
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogResponseOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-1" />
            Log Response
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBatchMode('action')}>
            <Layers className="h-4 w-4 mr-1" />
            Batch
          </Button>
          <Button size="sm" onClick={() => setAddClientOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <GlobalFilterBar filters={filters} onFiltersChange={setFilters} />

      {/* Tabs for Credit vs Consulting */}
      <Tabs defaultValue="credit" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="credit" className="flex items-center gap-2 data-[state=active]:bg-card">
            <Scale className="h-4 w-4" />
            Credit Compliance
          </TabsTrigger>
          <TabsTrigger value="consulting" className="flex items-center gap-2 data-[state=active]:bg-card">
            <Briefcase className="h-4 w-4" />
            Consulting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credit" className="space-y-4 mt-0">
          <ReinsertionAlert />
          <StatePressureStrip 
            activeFilter={stateFilter} 
            onFilterChange={(state) => setFilters({ ...filters, states: state ? [state] : ACTIVE_STATES })} 
            filters={filters}
          />
          {showChecklist && <DailyChecklist filters={filters} />}
          <TimeCriticalActions stateFilter={stateFilter} filters={filters} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ViolationAlerts filters={filters} />
          </div>
          <div className="pt-4 border-t">
            <MetricsSummary />
          </div>
        </TabsContent>

        <TabsContent value="consulting" className="mt-0">
          <ConsultingDashboard />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddClientDialog 
        open={addClientOpen} 
        onOpenChange={setAddClientOpen}
        onSuccess={() => refetchClients()}
      />
      <LogActionDialog open={logActionOpen} onOpenChange={setLogActionOpen} />
      <LogResponseDialog open={logResponseOpen} onOpenChange={setLogResponseOpen} />
      <BatchLoggingDialog 
        open={batchMode !== null} 
        onOpenChange={(open) => !open && setBatchMode(null)} 
        mode={batchMode || 'action'} 
      />
    </div>
  );
}
