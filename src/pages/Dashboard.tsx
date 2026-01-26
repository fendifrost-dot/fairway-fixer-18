import { StatCard } from '@/components/ui/StatCard';
import { RecentMatters } from '@/components/dashboard/RecentMatters';
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks';
import { DeadlineTimeline } from '@/components/dashboard/DeadlineTimeline';
import { ViolationAlerts } from '@/components/dashboard/ViolationAlerts';
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

export default function Dashboard() {
  const stats = mockDashboardStats;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Credit repair and consulting workflow overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Matters"
          value={stats.totalMatters}
          icon={FolderOpen}
        />
        <StatCard
          label="Active Disputes"
          value={stats.activeDisputes}
          icon={Scale}
          variant="warning"
        />
        <StatCard
          label="Violations Confirmed"
          value={stats.violationsConfirmed}
          icon={AlertTriangle}
          variant="danger"
        />
        <StatCard
          label="Overdue Deadlines"
          value={stats.overdueDeadlines}
          icon={Clock}
          variant={stats.overdueDeadlines > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Tasks Due Today"
          value={stats.tasksDueToday}
          icon={CheckSquare}
          variant={stats.tasksDueToday > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Reinsertions Detected"
          value={stats.reinsertionsDetected}
          icon={ShieldAlert}
          variant={stats.reinsertionsDetected > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Litigation Ready"
          value={stats.litigationReady}
          icon={Gavel}
          variant={stats.litigationReady > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentMatters />
        <UpcomingTasks />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeadlineTimeline />
        <ViolationAlerts />
      </div>
    </div>
  );
}
