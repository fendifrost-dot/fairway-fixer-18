import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAddCaseAction, type ActionCategory, type ActionPriority } from '@/hooks/useCaseActions';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  defaultCategory: ActionCategory;
}

export function AddEntryDialog({ open, onOpenChange, caseId, defaultCategory }: AddEntryDialogProps) {
  const [category, setCategory] = useState<ActionCategory>(defaultCategory);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<ActionPriority | ''>('');
  const [details, setDetails] = useState('');
  const [relatedEntity, setRelatedEntity] = useState('');
  const [relatedAccount, setRelatedAccount] = useState('');

  const addAction = useAddCaseAction();

  const resetForm = () => {
    setCategory(defaultCategory);
    setTitle('');
    setEventDate(new Date());
    setDueDate(undefined);
    setPriority('');
    setDetails('');
    setRelatedEntity('');
    setRelatedAccount('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    addAction.mutate({
      case_id: caseId,
      category,
      title: title.trim(),
      event_date: format(eventDate, 'yyyy-MM-dd'),
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      status: category === 'ToDo' ? 'Open' : 'Done',
      priority: priority || null,
      details: details.trim() || null,
      related_entity: relatedEntity.trim() || null,
      related_account: relatedAccount.trim() || null,
      related_account_masked: null,
    }, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      }
    });
  };

  // Update category when defaultCategory changes
  if (open && category !== defaultCategory) {
    setCategory(defaultCategory);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ActionCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Response">Dispute Response</SelectItem>
                <SelectItem value="ToDo">To Do</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., TransUnion Dispute, Innovis Freeze"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Event Date */}
          <div className="space-y-2">
            <Label>{category === 'ToDo' ? 'Created Date' : category === 'Response' ? 'Response Date' : 'Completed Date'}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(eventDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={(date) => date && setEventDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Due Date (only for ToDo) */}
          {category === 'ToDo' && (
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Priority (only for ToDo) */}
          {category === 'ToDo' && (
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ActionPriority)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Related Entity (for Response) */}
          {category === 'Response' && (
            <div className="space-y-2">
              <Label>Bureau / Furnisher</Label>
              <Input
                placeholder="e.g., TransUnion, Equifax"
                value={relatedEntity}
                onChange={(e) => setRelatedEntity(e.target.value)}
              />
            </div>
          )}

          {/* Related Account (for Response) */}
          {category === 'Response' && (
            <div className="space-y-2">
              <Label>Related Account</Label>
              <Input
                placeholder="e.g., Genesis CRDT"
                value={relatedAccount}
                onChange={(e) => setRelatedAccount(e.target.value)}
              />
            </div>
          )}

          {/* Details/Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional details..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || addAction.isPending}>
              {addAction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Entry
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
