import { StatCard } from '@/components/ui/StatCard';
import { useTasks, useDeadlines, useViolations, useStateCounts } from '@/hooks/useDashboardData';
import { 
  FolderOpen, 
  Scale, 
  AlertTriangle, 
  Clock, 
  CheckSquare,
  ShieldAlert,
  Gavel
} from 'lucide-react';
import { startOfDay, endOfDay, isBefore } from 'date-fns';

export function MetricsSummary() {
  const { data: tasks = [] } = useTasks();
  const { data: deadlines = [] } = useDeadlines();
  const { data: violations = [] } = useViolations();
  const { data: stateCounts } = useStateCounts();

  const now = new Date();
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Calculate metrics from real data
  const totalMatters = stateCounts 
    ? Object.values(stateCounts).reduce((sum, count) => sum + count, 0) 
    : 0;

  const activeDisputes = stateCounts?.DisputeActive ?? 0;
  const violationsConfirmed = violations.length;
  
  const overdueDeadlines = deadlines.filter(d => 
    isBefore(new Date(d.due_date), today) && d.status !== 'Closed'
  ).length;
  
  const tasksDueToday = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate <= todayEnd && t.status !== 'Done';
  }).length;

  const reinsertionsDetected = stateCounts?.ReinsertionDetected ?? 0;
  const litigationReady = stateCounts?.LitigationReady ?? 0;

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
          value={totalMatters}
          icon={FolderOpen}
          size="compact"
        />
        <StatCard
          label="Active Disputes"
          value={activeDisputes}
          icon={Scale}
          size="compact"
        />
        <StatCard
          label="Violations"
          value={violationsConfirmed}
          icon={AlertTriangle}
          variant="danger"
          size="compact"
        />
        <StatCard
          label="Overdue"
          value={overdueDeadlines}
          icon={Clock}
          variant={overdueDeadlines > 0 ? 'danger' : 'default'}
          size="compact"
        />
        <StatCard
          label="Due Today"
          value={tasksDueToday}
          icon={CheckSquare}
          variant={tasksDueToday > 0 ? 'warning' : 'default'}
          size="compact"
        />
        <StatCard
          label="Reinsertions"
          value={reinsertionsDetected}
          icon={ShieldAlert}
          variant={reinsertionsDetected > 0 ? 'danger' : 'default'}
          size="compact"
        />
        <StatCard
          label="Lit. Ready"
          value={litigationReady}
          icon={Gavel}
          variant={litigationReady > 0 ? 'danger' : 'default'}
          size="compact"
        />
      </div>
    </div>
  );
}
