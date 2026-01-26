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
import { IntakeWizard } from '@/components/intake/IntakeWizard';
import { LogActionDialog } from '@/components/logging/LogActionDialog';
import { LogResponseDialog } from '@/components/logging/LogResponseDialog';
import { DashboardFilters, MatterState } from '@/types/database';
import { Scale, Briefcase, Plus, FileText, MessageSquare } from 'lucide-react';

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
  
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [logActionOpen, setLogActionOpen] = useState(false);
  const [logResponseOpen, setLogResponseOpen] = useState(false);

  // Legacy state filter for existing components
  const stateFilter = filters.states.length === 1 ? filters.states[0] : null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Console</h1>
          <p className="text-muted-foreground mt-1">Statutory compliance and case management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLogActionOpen(true)}>
            <FileText className="h-4 w-4 mr-1" />
            Log Action
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogResponseOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-1" />
            Log Response
          </Button>
          <Button size="sm" onClick={() => setIntakeOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Intake
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
          />
          <TimeCriticalActions stateFilter={stateFilter} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ViolationAlerts />
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
      <IntakeWizard open={intakeOpen} onOpenChange={setIntakeOpen} />
      <LogActionDialog open={logActionOpen} onOpenChange={setLogActionOpen} />
      <LogResponseDialog open={logResponseOpen} onOpenChange={setLogResponseOpen} />
    </div>
  );
}
