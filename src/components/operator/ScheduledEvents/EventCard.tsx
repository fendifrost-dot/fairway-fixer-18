import { OperatorTask, TimelineEvent, SOURCE_DISPLAY_NAMES } from '@/types/operator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { Calendar, Trash2, Download, ExternalLink, Check, RotateCcw, Link2, Clock, RefreshCw, StickyNote } from 'lucide-react';

interface EventCardProps {
  task: OperatorTask;
  onMarkDone: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onDownloadICS: () => void;
  onOpenGoogleCalendar: () => void;
  linkedEvents?: TimelineEvent[];
}

export function EventCard({ 
  task, 
  onMarkDone, 
  onReopen,
  onDelete, 
  onDownloadICS, 
  onOpenGoogleCalendar,
  linkedEvents = [],
}: EventCardProps) {
  const isDone = task.status === 'Done';
  
  const getDueDateStyle = (dueDate: string | null) => {
    if (!dueDate) return '';
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return 'text-red-600 font-medium';
    if (isToday(date)) return 'text-amber-600 font-medium';
    return 'text-muted-foreground';
  };

  const formatDateTime = () => {
    if (!task.due_date) return null;
    const dateStr = format(parseISO(task.due_date), 'MMM d, yyyy');
    if (task.due_time) {
      // Format time from HH:MM:SS to readable format
      const [hours, minutes] = task.due_time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${dateStr} at ${displayHour}:${minutes} ${ampm}`;
    }
    return dateStr;
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border group hover:bg-muted/50 transition-colors ${isDone ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        {/* Date/Time row */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {task.due_date && (
            <span className={`text-xs ${isDone ? 'text-muted-foreground' : getDueDateStyle(task.due_date)}`}>
              {formatDateTime()}
            </span>
          )}
          {task.due_time && (
            <Clock className="h-3 w-3 text-muted-foreground" />
          )}
          {task.recurrence_rule && (
            <Tooltip>
              <TooltipTrigger>
                <RefreshCw className="h-3 w-3 text-blue-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Recurring: {task.recurrence_rule}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {/* Title */}
        <p className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}>
          {task.title}
        </p>

        {/* Notes */}
        {task.notes && (
          <div className="flex items-start gap-1 mt-1">
            <StickyNote className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground line-clamp-2">{task.notes}</p>
          </div>
        )}

        {/* Linked Events */}
        {linkedEvents.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <Link2 className="h-3 w-3 text-muted-foreground" />
            {linkedEvents.slice(0, 3).map(event => (
              <Badge key={event.id} variant="outline" className="text-[10px]">
                {event.source ? SOURCE_DISPLAY_NAMES[event.source] : 'Evidence'}
              </Badge>
            ))}
            {linkedEvents.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{linkedEvents.length - 3} more</span>
            )}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isDone ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={onReopen}
            title="Reopen"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reopen
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={onMarkDone}
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
                <DropdownMenuItem onClick={onOpenGoogleCalendar}>
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Open in Google Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDownloadICS}>
                  <Download className="h-3 w-3 mr-2" />
                  Download .ics file
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
