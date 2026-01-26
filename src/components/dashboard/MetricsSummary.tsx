import { StatCard } from '@/components/ui/StatCard';
import { mockDashboardStats } from '@/data/mockData';
import { 
  FolderOpen, 
  Scale, 
  AlertTriangle, 
  Clock, 
  CheckSquare,
  ShieldAlert,
  Gavel
} from 'lucide-react';

export function MetricsSummary() {
  const stats = mockDashboardStats;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Portfolio Metrics
        </h3>
      </div>
      
      {/* Compact grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard
          label="Matters"
          value={stats.totalMatters}
          icon={FolderOpen}
          size="compact"
        />
        <StatCard
          label="Active Disputes"
          value={stats.activeDisputes}
          icon={Scale}
          size="compact"
        />
        <StatCard
          label="Violations"
          value={stats.violationsConfirmed}
          icon={AlertTriangle}
          variant="danger"
          size="compact"
        />
        <StatCard
          label="Overdue"
          value={stats.overdueDeadlines}
          icon={Clock}
          variant={stats.overdueDeadlines > 0 ? 'danger' : 'default'}
          size="compact"
        />
        <StatCard
          label="Due Today"
          value={stats.tasksDueToday}
          icon={CheckSquare}
          variant={stats.tasksDueToday > 0 ? 'warning' : 'default'}
          size="compact"
        />
        <StatCard
          label="Reinsertions"
          value={stats.reinsertionsDetected}
          icon={ShieldAlert}
          variant={stats.reinsertionsDetected > 0 ? 'danger' : 'default'}
          size="compact"
        />
        <StatCard
          label="Lit. Ready"
          value={stats.litigationReady}
          icon={Gavel}
          variant={stats.litigationReady > 0 ? 'danger' : 'default'}
          size="compact"
        />
      </div>
    </div>
  );
}
