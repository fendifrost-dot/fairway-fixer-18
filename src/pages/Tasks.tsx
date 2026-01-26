import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PriorityBadge, StateBadge } from '@/components/ui/StatusBadge';
import { mockTasks, mockMatters } from '@/data/mockData';
import { 
  CheckSquare, 
  Search, 
  Plus, 
  Clock, 
  Filter,
  Circle,
  CheckCircle2,
  Loader2,
  Ban
} from 'lucide-react';
import { format, isToday, isTomorrow, differenceInDays, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Task, Priority, TaskStatus, PRIORITY_LABELS } from '@/types/workflow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusIcons: Record<TaskStatus, React.ElementType> = {
  Pending: Circle,
  InProgress: Loader2,
  Done: CheckCircle2,
  Blocked: Ban,
};

const statusStyles: Record<TaskStatus, string> = {
  Pending: 'text-muted-foreground',
  InProgress: 'text-accent animate-pulse-subtle',
  Done: 'text-state-resolved',
  Blocked: 'text-state-violation',
};

export default function Tasks() {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const filteredTasks = mockTasks.filter(task => {
    const matchesSearch = task.taskType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && task.status !== 'Done') ||
      task.status === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  // Group tasks by priority
  const tasksByPriority = filteredTasks.reduce((acc, task) => {
    if (!acc[task.priority]) acc[task.priority] = [];
    acc[task.priority].push(task);
    return acc;
  }, {} as Record<Priority, Task[]>);

  const getMatterTitle = (matterId: string) => {
    const matter = mockMatters.find(m => m.id === matterId);
    return matter?.title || 'Unknown Matter';
  };

  const getMatterState = (matterId: string) => {
    const matter = mockMatters.find(m => m.id === matterId);
    return matter?.primaryState;
  };

  const formatDueDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    const days = differenceInDays(date, new Date());
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days < 7) return `in ${days}d`;
    return format(date, 'MMM d');
  };

  const getDueDateStyle = (date: Date | undefined) => {
    if (!date) return '';
    if (isPast(date) && !isToday(date)) return 'deadline-overdue';
    if (isToday(date) || differenceInDays(date, new Date()) <= 2) return 'deadline-due-soon';
    return 'deadline-open';
  };

  const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-accent" />
            Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage workflow tasks and deadlines
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {priorities.map(p => (
              <SelectItem key={p} value={p}>{p} - {PRIORITY_LABELS[p].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="InProgress">In Progress</SelectItem>
            <SelectItem value="Done">Done</SelectItem>
            <SelectItem value="Blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks by Priority */}
      <div className="space-y-6">
        {priorities.map(priority => {
          const tasks = tasksByPriority[priority];
          if (!tasks || tasks.length === 0) return null;

          return (
            <Card key={priority} className="card-elevated">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  <PriorityBadge priority={priority} />
                  <span className="font-medium">{PRIORITY_LABELS[priority].label}</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    — {PRIORITY_LABELS[priority].description}
                  </span>
                  <span className="ml-auto text-sm text-muted-foreground font-normal">
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y">
                  {tasks.map(task => {
                    const StatusIcon = statusIcons[task.status];
                    const matterState = getMatterState(task.matterId);
                    
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-4 py-3 group hover:bg-secondary/30 -mx-4 px-4 transition-colors"
                      >
                        <Checkbox 
                          checked={task.status === 'Done'}
                          className="h-5 w-5"
                        />
                        
                        <StatusIcon className={cn("h-4 w-4 flex-shrink-0", statusStyles[task.status])} />
                        
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "font-medium text-sm",
                            task.status === 'Done' && "line-through text-muted-foreground"
                          )}>
                            {task.taskType}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{getMatterTitle(task.matterId)}</span>
                            {matterState && (
                              <>
                                <span>•</span>
                                <StateBadge state={matterState} size="sm" />
                              </>
                            )}
                            {task.autoGenerated && (
                              <>
                                <span>•</span>
                                <span className="italic">Auto-generated</span>
                              </>
                            )}
                          </div>
                        </div>

                        {task.dueDate && (
                          <div className={cn(
                            "flex items-center gap-1.5 text-xs flex-shrink-0",
                            getDueDateStyle(task.dueDate)
                          )}>
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatDueDate(task.dueDate)}</span>
                          </div>
                        )}

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7"
                        >
                          Details
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <CheckSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No tasks found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
