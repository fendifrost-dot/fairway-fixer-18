import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTasks } from '@/hooks/useDashboardData';
import { useUpdateTaskStatus } from '@/hooks/useMutations';
import { DashboardFilters, CHECKLIST_TASK_TYPES, TaskPriority } from '@/types/database';
import { cn } from '@/lib/utils';
import { differenceInDays, format, parseISO } from 'date-fns';
import { 
  CheckCircle2, 
  FileSearch, 
  Globe, 
  Mail, 
  Database, 
  Building2,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DailyChecklistProps {
  filters?: DashboardFilters;
}

const TASK_CATEGORY_CONFIG: Record<string, { 
  icon: React.ElementType; 
  label: string; 
  taskTypes: string[];
  priority: number;
}> = {
  statutory: {
    icon: FileSearch,
    label: 'P0 Statutory / Deadline-driven',
    taskTypes: ['Check Credit Report (CRA)', 'Classify Response'],
    priority: 1,
  },
  cfpb: {
    icon: Globe,
    label: 'CFPB / Agency Checks',
    taskTypes: ['Check CFPB Portal'],
    priority: 2,
  },
  mail: {
    icon: Mail,
    label: 'Mail / Delivery Proofs',
    taskTypes: ['Check Mail / Delivery / Proof'],
    priority: 3,
  },
  dataBroker: {
    icon: Database,
    label: 'Data Broker / PIN Checks',
    taskTypes: ['Check Data Broker Freeze Status'],
    priority: 4,
  },
  furnisher: {
    icon: Building2,
    label: 'Furnisher Response Checks',
    taskTypes: ['Check Furnisher Response'],
    priority: 5,
  },
};

export function DailyChecklist({ filters }: DailyChecklistProps) {
  const { data: tasks = [], isLoading } = useTasks(filters);
  const updateTaskStatus = useUpdateTaskStatus();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    statutory: true,
    cfpb: true,
    mail: true,
    dataBroker: true,
    furnisher: true,
  });
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());

  // Filter to only checklist-type tasks
  const checklistTasks = tasks.filter(task => 
    CHECKLIST_TASK_TYPES.some(type => task.task_type.includes(type.split(' ')[0]))
  );

  // Group tasks by category
  const categorizedTasks = Object.entries(TASK_CATEGORY_CONFIG).map(([key, config]) => {
    const categoryTasks = checklistTasks.filter(task =>
      config.taskTypes.some(type => task.task_type.includes(type.split(' ')[0]))
    );
    
    return {
      key,
      ...config,
      tasks: categoryTasks.sort((a, b) => {
        // Sort by priority first, then by due date
        const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }),
    };
  }).filter(cat => cat.tasks.length > 0);

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTasks(prev => new Set(prev).add(taskId));
    try {
      await updateTaskStatus.mutateAsync({ taskId, status: 'Done' });
    } finally {
      setCompletingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const formatDue = (dueDate: string | null) => {
    if (!dueDate) return '';
    const date = parseISO(dueDate);
    const days = differenceInDays(date, new Date());
    if (days < 0) return `Overdue (${format(date, 'MMM d')})`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const getDueStyle = (dueDate: string | null) => {
    if (!dueDate) return '';
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return 'text-[hsl(var(--state-violation))] font-semibold';
    if (days === 0) return 'text-[hsl(var(--state-active))] font-semibold';
    return 'text-muted-foreground';
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'P0': return 'bg-[hsl(var(--state-violation))]';
      case 'P1': return 'bg-[hsl(var(--state-active))]';
      case 'P2': return 'bg-[hsl(var(--state-partial))]';
      case 'P3': return 'bg-muted-foreground';
    }
  };

  const totalTasks = checklistTasks.length;
  const completedToday = 0; // Would track completed in session

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-accent" />
          Daily Checklist
          <span className="text-sm font-normal text-muted-foreground">
            ({totalTasks} tasks)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : categorizedTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-[hsl(var(--state-resolved))]" />
            <p>All checklist tasks complete!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {categorizedTasks.map(category => {
              const Icon = category.icon;
              const isExpanded = expandedCategories[category.key];
              
              return (
                <div key={category.key} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.key)}
                    className="w-full flex items-center justify-between p-3 bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-accent" />
                      <span className="font-medium text-sm">{category.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({category.tasks.length})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="divide-y">
                      {category.tasks.map(task => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors",
                            completingTasks.has(task.id) && "opacity-50"
                          )}
                        >
                          <Checkbox
                            checked={false}
                            disabled={completingTasks.has(task.id)}
                            onCheckedChange={() => handleCompleteTask(task.id)}
                            className="h-5 w-5"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={cn(
                                "w-5 h-5 rounded text-xs font-bold flex items-center justify-center text-white",
                                getPriorityColor(task.priority)
                              )}>
                                {task.priority}
                              </span>
                              <span className="font-medium text-sm truncate">
                                {task.task_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Link 
                                to={`/clients/${task.matter?.client_id}`}
                                className="hover:text-accent"
                              >
                                {task.matter?.client?.preferred_name || task.matter?.client?.legal_name}
                              </Link>
                              <span>•</span>
                              <Link 
                                to={`/matters/${task.matter_id}`}
                                className="hover:text-accent truncate"
                              >
                                {task.matter?.title}
                              </Link>
                              {task.entity_case && (
                                <>
                                  <span>•</span>
                                  <span>{task.entity_case.entity_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className={cn("text-xs whitespace-nowrap", getDueStyle(task.due_date))}>
                            {formatDue(task.due_date)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
