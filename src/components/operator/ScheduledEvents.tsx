import { OperatorTask } from '@/types/operator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { Calendar, CalendarPlus, Trash2, Download, ExternalLink, Check } from 'lucide-react';
import { useCreateOperatorTask, useUpdateOperatorTask, useDeleteOperatorTask } from '@/hooks/useOperatorTasks';
import { downloadICSFile, generateGoogleCalendarUrl } from '@/lib/icsExport';
import { toast } from 'sonner';
import { useState } from 'react';

interface ScheduledEventsProps {
  tasks: OperatorTask[];
  clientId: string;
}

export function ScheduledEvents({ tasks, clientId }: ScheduledEventsProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  
  const createTask = useCreateOperatorTask();
  const updateTask = useUpdateOperatorTask();
  const deleteTask = useDeleteOperatorTask();
  
  // Sort by due_date ASC
  const openEvents = tasks
    .filter(t => t.status === 'Open')
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  
  const doneEvents = tasks
    .filter(t => t.status === 'Done')
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  
  const handleCreate = () => {
    if (!newTitle.trim() || !newDueDate) {
      toast.error('Title and due date are required');
      return;
    }
    
    createTask.mutate({
      client_id: clientId,
      title: newTitle.trim(),
      due_date: newDueDate,
      priority: 'Medium',
      status: 'Open',
    }, {
      onSuccess: () => {
        setNewTitle('');
        setNewDueDate('');
        toast.success('Scheduled event created');
      }
    });
  };
  
  const handleMarkDone = (task: OperatorTask) => {
    updateTask.mutate({
      id: task.id,
      clientId,
      updates: { status: 'Done' },
    });
  };
  
  const handleDownloadICS = (task: OperatorTask) => {
    const dueDate = task.due_date ? parseISO(task.due_date) : new Date();
    downloadICSFile({
      title: task.title,
      description: `Priority: ${task.priority}`,
      startDate: dueDate,
      allDay: true,
    });
    toast.success('Calendar file downloaded');
  };
  
  const handleOpenGoogleCalendar = (task: OperatorTask) => {
    const dueDate = task.due_date ? parseISO(task.due_date) : new Date();
    const url = generateGoogleCalendarUrl({
      title: task.title,
      description: `Priority: ${task.priority}`,
      startDate: dueDate,
      allDay: true,
    });
    window.open(url, '_blank');
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
          <CalendarPlus className="h-4 w-4" />
          Scheduled Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new event */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <Input
            placeholder="Event title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Button 
              size="sm" 
              onClick={handleCreate}
              disabled={createTask.isPending}
              className="h-8"
            >
              Create
            </Button>
          </div>
        </div>
        
        {openEvents.length === 0 && doneEvents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scheduled events yet. Create one above.
          </p>
        )}
        
        {openEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Upcoming ({openEvents.length})
            </h4>
            {openEvents.map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border group hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {task.due_date && (
                      <span className={`text-xs ${getDueDateStyle(task.due_date)}`}>
                        {format(parseISO(task.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{task.title}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleMarkDone(task)}
                    title="Mark Done"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Done
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 px-2 text-xs"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        Calendar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenGoogleCalendar(task)}>
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Open in Google Calendar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadICS(task)}>
                        <Download className="h-3 w-3 mr-2" />
                        Download .ics file
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
        
        {doneEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Completed ({doneEvents.length})
            </h4>
            {doneEvents.map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border opacity-60 group">
                <div className="flex-1 min-w-0">
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(task.due_date), 'MMM d, yyyy')}
                    </span>
                  )}
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
