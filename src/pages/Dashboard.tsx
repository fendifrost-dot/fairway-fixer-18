import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReinsertionAlert } from '@/components/dashboard/ReinsertionAlert';
import { StatePressureStrip } from '@/components/dashboard/StatePressureStrip';
import { TimeCriticalActions } from '@/components/dashboard/TimeCriticalActions';
import { MetricsSummary } from '@/components/dashboard/MetricsSummary';
import { ViolationAlerts } from '@/components/dashboard/ViolationAlerts';
import { ConsultingDashboard } from '@/components/dashboard/ConsultingDashboard';
import { MatterState } from '@/types/workflow';
import { Scale, Briefcase } from 'lucide-react';

export default function Dashboard() {
  const [stateFilter, setStateFilter] = useState<MatterState | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Command Console</h1>
        <p className="text-muted-foreground mt-1">
          Statutory compliance and case management
        </p>
      </div>

      {/* Tabs for Credit vs Consulting */}
      <Tabs defaultValue="credit" className="space-y-6">
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

        {/* Credit Compliance Dashboard */}
        <TabsContent value="credit" className="space-y-6 mt-0">
          {/* SECTION 1: Reinsertion Alert (only when active) */}
          <ReinsertionAlert />

          {/* SECTION 2: State Pressure Strip */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Case States
            </h2>
            <StatePressureStrip 
              activeFilter={stateFilter} 
              onFilterChange={setStateFilter} 
            />
          </div>

          {/* SECTION 3: Time-Critical Actions (fused tasks + deadlines) */}
          <TimeCriticalActions stateFilter={stateFilter} />

          {/* SECTION 4: Violations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ViolationAlerts />
          </div>

          {/* SECTION 5: Metrics Summary (demoted to bottom) */}
          <div className="pt-4 border-t">
            <MetricsSummary />
          </div>
        </TabsContent>

        {/* Consulting Dashboard */}
        <TabsContent value="consulting" className="mt-0">
          <ConsultingDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
