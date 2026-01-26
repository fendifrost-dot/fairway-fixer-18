import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriorityBadge } from '@/components/ui/StatusBadge';
import { mockTasks, mockMatters } from '@/data/mockData';
import { ArrowRight, CheckSquare, Circle, Clock } from 'lucide-react';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

export function UpcomingTasks() {
  const upcomingTasks = mockTasks
    .filter(t => t.status !== 'Done' && t.dueDate)
    .sort((a, b) => {
      // Sort by priority first, then by due date
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0);
    })
    .slice(0, 6);

  const getMatterTitle = (matterId: string) => {
    const matter = mockMatters.find(m => m.id === matterId);
    return matter?.title || 'Unknown Matter';
  };

  const formatDueDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    const days = differenceInDays(date, new Date());
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days < 7) return `${days}d`;
    return format(date, 'MMM d');
  };

  const getDueDateStyle = (date: Date) => {
    const days = differenceInDays(date, new Date());
    if (days < 0) return 'deadline-overdue';
    if (days <= 2) return 'deadline-due-soon';
    return 'deadline-open';
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-muted-foreground" />
          Upcoming Tasks
        </CardTitle>
        <Link 
          to="/tasks" 
          className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 font-medium"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {upcomingTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="mt-0.5">
                <Circle className={cn(
                  "h-4 w-4",
                  task.status === 'InProgress' ? 'text-accent fill-accent/20' : 'text-muted-foreground'
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{task.taskType}</p>
                <p className="text-xs text-muted-foreground truncate">{getMatterTitle(task.matterId)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PriorityBadge priority={task.priority} size="sm" />
                {task.dueDate && (
                  <span className={cn("text-xs flex items-center gap-1", getDueDateStyle(task.dueDate))}>
                    <Clock className="h-3 w-3" />
                    {formatDueDate(task.dueDate)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
