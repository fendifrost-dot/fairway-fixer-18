import { OperatorTask, TimelineEvent } from '@/types/operator';

export interface ScheduledEventsProps {
  tasks: OperatorTask[];
  clientId: string;
  timelineEvents?: TimelineEvent[];
}

export interface EventFormData {
  title: string;
  dueDate: string;
  dueTime: string;
  notes: string;
  linkedEventIds: string[];
  recurrenceRule: string | null;
}

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'No recurrence' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
] as const;
