/**
 * Add Entry Dialog
 * Manual creation of a single timeline event with stable predictable form fields.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCreateTimelineEvent } from '@/hooks/useTimelineEvents';
import { useFurnishers, useCreateFurnisher } from '@/hooks/useFurnishers';
import { useTradelines, useCreateTradeline } from '@/hooks/useTradelines';
import { ALL_SOURCES, SOURCE_DISPLAY_NAMES, EVENT_CATEGORIES, EventSource, EventCategory } from '@/types/operator';

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

export function AddEntryDialog({ open, onOpenChange, clientId }: AddEntryDialogProps) {
  const createEvent = useCreateTimelineEvent();
  const { data: furnishers = [] } = useFurnishers(clientId);
  const createFurnisher = useCreateFurnisher();
  const { data: tradelines = [] } = useTradelines(clientId);
  const createTradeline = useCreateTradeline();
  
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
  const [category, setCategory] = useState<EventCategory>('Action');
  const [eventKind, setEventKind] = useState<string>('action');
  const [source, setSource] = useState<string>('');
  const [furnisherId, setFurnisherId] = useState<string>('');
  const [showNewFurnisher, setShowNewFurnisher] = useState(false);
  const [newFurnisherName, setNewFurnisherName] = useState('');
  const [newFurnisherLast4, setNewFurnisherLast4] = useState('');
  const [tradelineId, setTradelineId] = useState<string>('');
  const [showNewTradeline, setShowNewTradeline] = useState(false);
  const [newTradelineName, setNewTradelineName] = useState('');
  const [newTradelineLast4, setNewTradelineLast4] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [rawLine, setRawLine] = useState('');

  const categoryToKind: Record<EventCategory, string> = {
    Action: 'action',
    Response: 'response',
    Outcome: 'outcome',
    Note: 'note',
  };

  const handleCategoryChange = (val: EventCategory) => {
    setCategory(val);
    setEventKind(categoryToKind[val]);
  };

  const resetForm = () => {
    setEventDate(undefined);
    setCategory('Action');
    setEventKind('action');
    setSource('');
    setFurnisherId('');
    setShowNewFurnisher(false);
    setNewFurnisherName('');
    setNewFurnisherLast4('');
    setTradelineId('');
    setShowNewTradeline(false);
    setNewTradelineName('');
    setNewTradelineLast4('');
    setTitle('');
    setSummary('');
    setDetails('');
    setRawLine('');
  };

  const handleSubmit = async () => {
    const dateStr = eventDate ? format(eventDate, 'yyyy-MM-dd') : null;
    const effectiveRawLine = rawLine.trim() || summary.trim() || title.trim();
    
    if (!effectiveRawLine) return;

    // If user filled the inline new-furnisher form but didn't click "Add",
    // create it now so the event attaches to it.
    let resolvedFurnisherId: string | null = furnisherId || null;
    if (showNewFurnisher && newFurnisherName.trim()) {
      try {
        const created = await createFurnisher.mutateAsync({
          client_id: clientId,
          name: newFurnisherName.trim(),
          account_last4: newFurnisherLast4.trim() || null,
        });
        resolvedFurnisherId = created.id;
      } catch {
        // Toast already handled by hook; abort submit so user can retry.
        return;
      }
    }

    let resolvedTradelineId: string | null = tradelineId || null;
    if (showNewTradeline && newTradelineName.trim()) {
      try {
        const created = await createTradeline.mutateAsync({
          client_id: clientId,
          display_name: newTradelineName.trim(),
          account_last4: newTradelineLast4.trim() || null,
        });
        resolvedTradelineId = created.id;
      } catch {
        return;
      }
    }

    createEvent.mutate({
      client_id: clientId,
      event_date: dateStr,
      date_is_unknown: !dateStr,
      category: category,
      source: (source || null) as EventSource | null,
      title: title || category,
      summary: summary || title,
      details: details || null,
      related_accounts: null,
      raw_line: effectiveRawLine,
      event_kind: eventKind,
      is_draft: false,
      furnisher_id: resolvedFurnisherId,
      tradeline_id: resolvedTradelineId,
    }, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      },
    });
  };

  const canSubmit =
    (title.trim() || summary.trim()) && !createEvent.isPending && !createFurnisher.isPending && !createTradeline.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Timeline Entry</DialogTitle>
          <DialogDescription>Manually add an evidence event to the timeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Action Date */}
          <div className="space-y-1">
            <Label htmlFor="add-event-date">Action Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="add-event-date"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, 'PPP') : 'Pick a date (optional)'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label htmlFor="add-category">Category</Label>
            <Select value={category} onValueChange={(v) => handleCategoryChange(v as EventCategory)}>
              <SelectTrigger id="add-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.filter(c => c !== 'Note').map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-1">
            <Label htmlFor="add-source">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="add-source"><SelectValue placeholder="Select source..." /></SelectTrigger>
              <SelectContent>
                {ALL_SOURCES.map(s => (
                  <SelectItem key={s} value={s}>{SOURCE_DISPLAY_NAMES[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Furnisher (optional) — coexists with Source */}
          <div className="space-y-1">
            <Label htmlFor="add-furnisher">Furnisher (optional)</Label>
            {!showNewFurnisher ? (
              <div className="flex gap-2">
                <Select
                  value={furnisherId || '__none__'}
                  onValueChange={(v) => setFurnisherId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger id="add-furnisher" className="flex-1">
                    <SelectValue placeholder="No furnisher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No furnisher</SelectItem>
                    {furnishers.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        {f.account_last4 ? ` (…${f.account_last4})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewFurnisher(true);
                    setFurnisherId('');
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border p-2 bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    placeholder="Furnisher name"
                    value={newFurnisherName}
                    onChange={(e) => setNewFurnisherName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Last 4"
                    value={newFurnisherLast4}
                    onChange={(e) => setNewFurnisherLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-20 font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewFurnisher(false);
                      setNewFurnisherName('');
                      setNewFurnisherLast4('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!newFurnisherName.trim() || createFurnisher.isPending}
                    onClick={async () => {
                      const created = await createFurnisher.mutateAsync({
                        client_id: clientId,
                        name: newFurnisherName.trim(),
                        account_last4: newFurnisherLast4.trim() || null,
                      });
                      setFurnisherId(created.id);
                      setShowNewFurnisher(false);
                      setNewFurnisherName('');
                      setNewFurnisherLast4('');
                    }}
                  >
                    Add furnisher
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Tradeline (optional) — coexists with Source and Furnisher */}
          <div className="space-y-1">
            <Label htmlFor="add-tradeline">Tradeline (optional)</Label>
            {!showNewTradeline ? (
              <div className="flex gap-2">
                <Select
                  value={tradelineId || '__none__'}
                  onValueChange={(v) => setTradelineId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger id="add-tradeline" className="flex-1">
                    <SelectValue placeholder="No tradeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No tradeline</SelectItem>
                    {tradelines.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.display_name}
                        {t.account_last4 ? ` (…${t.account_last4})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNewTradeline(true);
                    setTradelineId('');
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border p-2 bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    placeholder="Tradeline display name"
                    value={newTradelineName}
                    onChange={(e) => setNewTradelineName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Last 4"
                    value={newTradelineLast4}
                    onChange={(e) => setNewTradelineLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-20 font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewTradeline(false);
                      setNewTradelineName('');
                      setNewTradelineLast4('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!newTradelineName.trim() || createTradeline.isPending}
                    onClick={async () => {
                      const created = await createTradeline.mutateAsync({
                        client_id: clientId,
                        display_name: newTradelineName.trim(),
                        account_last4: newTradelineLast4.trim() || null,
                      });
                      setTradelineId(created.id);
                      setShowNewTradeline(false);
                      setNewTradelineName('');
                      setNewTradelineLast4('');
                    }}
                  >
                    Add tradeline
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="add-title">Title</Label>
            <Input id="add-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dispute Letter Sent" />
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <Label htmlFor="add-summary">Summary</Label>
            <Textarea id="add-summary" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>

          {/* Details */}
          <div className="space-y-1">
            <Label htmlFor="add-details">Details (optional)</Label>
            <Textarea id="add-details" value={details} onChange={e => setDetails(e.target.value)} placeholder="Additional context..." rows={2} />
          </div>

          {/* Raw Line */}
          <div className="space-y-1">
            <Label htmlFor="add-rawline">Raw Evidence Text</Label>
            <Textarea id="add-rawline" value={rawLine} onChange={e => setRawLine(e.target.value)} placeholder="Verbatim source text (auto-filled from summary if empty)" rows={3} className="font-mono text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createEvent.isPending ? 'Adding...' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
