import { OperatorTask, TimelineEvent } from '@/types/operator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus } from 'lucide-react';
import { useCreateOperatorTask, useUpdateOperatorTask, useDeleteOperatorTask } from '@/hooks/useOperatorTasks';
import { downloadICSFile, generateGoogleCalendarUrl } from '@/lib/icsExport';
import { toast } from 'sonner';
import { parseISO } from 'date-fns';
import { EventForm } from './EventForm';
import { EventCard } from './EventCard';
import { ScheduledEventsProps, EventFormData } from './types';
import { TooltipProvider } from '@/components/ui/tooltip';

export function ScheduledEvents({ tasks, clientId, timelineEvents = [] }: ScheduledEventsProps) {
  const createTask = useCreateOperatorTask();
  const updateTask = useUpdateOperatorTask();
  const deleteTask = useDeleteOperatorTask();
  
  // Sort by due_date ASC
  const sortByDate = (a: OperatorTask, b: OperatorTask) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  };

  const openEvents = tasks.filter(t => t.status === 'Open').sort(sortByDate);
  const doneEvents = tasks.filter(t => t.status === 'Done').sort(sortByDate);
  
  const handleCreate = (data: EventFormData) => {
    createTask.mutate({
      client_id: clientId,
      title: data.title,
      due_date: data.dueDate,
      due_time: data.dueTime || null,
      notes: data.notes || null,
      linked_event_ids: data.linkedEventIds,
      recurrence_rule: data.recurrenceRule,
      priority: 'Medium',
      status: 'Open',
    }, {
      onSuccess: () => {
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

  const handleReopen = (task: OperatorTask) => {
    updateTask.mutate({
      id: task.id,
      clientId,
      updates: { status: 'Open' },
    });
  };
  
  const handleDownloadICS = (task: OperatorTask) => {
    const dueDate = task.due_date ? parseISO(task.due_date) : new Date();
    downloadICSFile({
      title: task.title,
      description: `Priority: ${task.priority}${task.notes ? `\n\n${task.notes}` : ''}`,
      startDate: dueDate,
      allDay: !task.due_time,
    });
    toast.success('Calendar file downloaded');
  };
  
  const handleOpenGoogleCalendar = (task: OperatorTask) => {
    const dueDate = task.due_date ? parseISO(task.due_date) : new Date();
    const url = generateGoogleCalendarUrl({
      title: task.title,
      description: `Priority: ${task.priority}${task.notes ? `\n\n${task.notes}` : ''}`,
      startDate: dueDate,
      allDay: !task.due_time,
    });
    window.open(url, '_blank');
  };

  // Get linked timeline events for a task
  const getLinkedEvents = (task: OperatorTask): TimelineEvent[] => {
    if (!task.linked_event_ids || task.linked_event_ids.length === 0) return [];
    return timelineEvents.filter(e => task.linked_event_ids.includes(e.id));
  };
  
  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" />
            Scheduled Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new event */}
          <EventForm 
            onSubmit={handleCreate}
            isLoading={createTask.isPending}
            timelineEvents={timelineEvents}
          />
          
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
                <EventCard
                  key={task.id}
                  task={task}
                  onMarkDone={() => handleMarkDone(task)}
                  onReopen={() => handleReopen(task)}
                  onDelete={() => deleteTask.mutate({ id: task.id, clientId })}
                  onDownloadICS={() => handleDownloadICS(task)}
                  onOpenGoogleCalendar={() => handleOpenGoogleCalendar(task)}
                  linkedEvents={getLinkedEvents(task)}
                />
              ))}
            </div>
          )}
          
          {doneEvents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed ({doneEvents.length})
              </h4>
              {doneEvents.map(task => (
                <EventCard
                  key={task.id}
                  task={task}
                  onMarkDone={() => handleMarkDone(task)}
                  onReopen={() => handleReopen(task)}
                  onDelete={() => deleteTask.mutate({ id: task.id, clientId })}
                  onDownloadICS={() => handleDownloadICS(task)}
                  onOpenGoogleCalendar={() => handleOpenGoogleCalendar(task)}
                  linkedEvents={getLinkedEvents(task)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// Re-export for backward compatibility
export type { ScheduledEventsProps } from './types';
