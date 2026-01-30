import { OperatorTask } from '@/types/operator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { Calendar, ListTodo, Trash2 } from 'lucide-react';
import { useUpdateOperatorTask, useDeleteOperatorTask } from '@/hooks/useOperatorTasks';

interface TaskListProps {
  tasks: OperatorTask[];
  clientId: string;
}

export function TaskList({ tasks, clientId }: TaskListProps) {
  const updateTask = useUpdateOperatorTask();
  const deleteTask = useDeleteOperatorTask();
  
  const openTasks = tasks.filter(t => t.status === 'Open');
  const doneTasks = tasks.filter(t => t.status === 'Done');
  
  const handleToggle = (task: OperatorTask) => {
    updateTask.mutate({
      id: task.id,
      clientId,
      updates: { status: task.status === 'Open' ? 'Done' : 'Open' },
    });
  };
  
  const handleAddToCalendar = (task: OperatorTask) => {
    // Placeholder - just show an alert for now
    alert(`Calendar integration coming soon!\n\nTask: ${task.title}\nDue: ${task.due_date || 'No due date'}`);
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };
  
  const getDueDateStyle = (dueDate: string | null) => {
    if (!dueDate) return '';
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return 'text-red-600 font-medium';
    if (isToday(date)) return 'text-amber-600 font-medium';
    return 'text-muted-foreground';
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListTodo className="h-4 w-4" />
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {openTasks.length === 0 && doneTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tasks yet. Create tasks from recommendations or import them.
          </p>
        )}
        
        {openTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open ({openTasks.length})</h4>
            {openTasks.map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border group hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => handleToggle(task)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                    {task.due_date && (
                      <span className={`text-xs ${getDueDateStyle(task.due_date)}`}>
                        Due: {format(parseISO(task.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{task.title}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 px-2 text-xs"
                    onClick={() => handleAddToCalendar(task)}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Calendar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => deleteTask.mutate({ id: task.id, clientId })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {doneTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Done ({doneTasks.length})</h4>
            {doneTasks.map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border opacity-60 group">
                <Checkbox
                  checked={true}
                  onCheckedChange={() => handleToggle(task)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through">{task.title}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => deleteTask.mutate({ id: task.id, clientId })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
