/**
 * Tradelines Panel (B5)
 *
 * Cross-bureau pivot view: each tradeline rendered as a collapsible row with
 * a 3-column grid (EQ / EX / TU) showing presence, status verbatim, and
 * last_seen_date, plus the most recent attached events.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CreditCard, Plus, Check, X, AlertTriangle, ChevronDown } from 'lucide-react';
import { useTradelines, useTradelineBureauStates, useCreateTradeline } from '@/hooks/useTradelines';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import type { Tradeline, TradelineBureau, TradelineBureauState } from '@/types/operator';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

const BUREAUS: { key: TradelineBureau; label: string }[] = [
  { key: 'equifax', label: 'Equifax' },
  { key: 'experian', label: 'Experian' },
  { key: 'transunion', label: 'TransUnion' },
];

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
}

interface Props {
  clientId: string;
}

export function TradelinesPanel({ clientId }: Props) {
  const { data: tradelines = [] } = useTradelines(clientId);
  const { data: bureauStates = [] } = useTradelineBureauStates(clientId);
  const { data: events = [] } = useTimelineEvents(clientId);
  const [showAdd, setShowAdd] = useState(false);

  const statesByTradeline = useMemo(() => {
    const m = new Map<string, TradelineBureauState[]>();
    for (const s of bureauStates) {
      const arr = m.get(s.tradeline_id) || [];
      arr.push(s);
      m.set(s.tradeline_id, arr);
    }
    return m;
  }, [bureauStates]);

  const eventsByTradeline = useMemo(() => {
    const m = new Map<string, typeof events>();
    for (const e of events) {
      const tid = (e as any).tradeline_id as string | null | undefined;
      if (!tid) continue;
      const arr = m.get(tid) || [];
      arr.push(e);
      m.set(tid, arr);
    }
    return m;
  }, [events]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Tradelines ({tradelines.length})
          </CardTitle>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-3 w-3" /> Add tradeline
              </Button>
            </DialogTrigger>
            <AddTradelineDialog clientId={clientId} onClose={() => setShowAdd(false)} />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tradelines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tradelines yet. Add one manually, tag rows in the ChatGPT Update with
            <code className="mx-1 px-1 py-0.5 rounded bg-muted text-xs">[Tradeline: "…"]</code>,
            or let intake auto-extract create them.
          </p>
        ) : (
          <div className="space-y-3">
            {tradelines.map(tl => (
              <TradelineRow
                key={tl.id}
                tradeline={tl}
                states={statesByTradeline.get(tl.id) || []}
                recentEvents={(eventsByTradeline.get(tl.id) || [])
                  .slice()
                  .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
                  .slice(0, 3)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TradelineRow({
  tradeline, states, recentEvents,
}: {
  tradeline: Tradeline;
  states: TradelineBureauState[];
  recentEvents: { id: string; title: string; event_date: string | null; source: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const stateByBureau = new Map(states.map(s => [s.bureau, s] as const));

  // Cross-bureau check: flag if presence differs across bureaus (any present + any explicitly absent).
  const anyPresent = states.some(s => s.present);
  const anyAbsent = states.some(s => s.present === false);
  const inconsistent = anyPresent && anyAbsent;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{tradeline.display_name}</span>
            {tradeline.account_last4 && (
              <span className="text-xs text-muted-foreground font-mono">…{tradeline.account_last4}</span>
            )}
            {tradeline.balance != null && (
              <Badge variant="secondary" className="text-[10px]">${tradeline.balance.toLocaleString()}</Badge>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{tradeline.status}</Badge>
            {inconsistent && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="h-3 w-3" /> Cross-bureau check
              </Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {BUREAUS.map(({ key, label }) => {
                const s = stateByBureau.get(key);
                return (
                  <div key={key} className="border rounded-md p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{label}</span>
                      {s?.present ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : s?.present === false ? (
                        <X className="h-3 w-3 text-destructive" />
                      ) : (
                        <span className="text-muted-foreground">?</span>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {s?.status_on_bureau || '—'}
                    </div>
                    <div className="text-muted-foreground">{fmtDate(s?.last_seen_date ?? null)}</div>
                  </div>
                );
              })}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Recent events</div>
              {recentEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No events attached yet.</p>
              ) : (
                <div className="space-y-1">
                  {recentEvents.map(e => (
                    <div key={e.id} className="text-xs flex items-center gap-2">
                      <span className="text-muted-foreground tabular-nums">{fmtDate(e.event_date)}</span>
                      <span className="font-medium">{e.source || '—'}</span>
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function AddTradelineDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [balance, setBalance] = useState('');
  const create = useCreateTradeline();

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Display name is required');
      return;
    }
    try {
      await create.mutateAsync({
        client_id: clientId,
        display_name: name.trim(),
        account_last4: last4.trim() || null,
        balance: balance.trim() ? Number(balance) : null,
      });
      toast.success('Tradeline added');
      setName(''); setLast4(''); setBalance('');
      onClose();
    } catch { /* toast handled in hook */ }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add tradeline</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Display name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Discover $439 charge-off" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Account last 4</Label>
            <Input value={last4} onChange={e => setLast4(e.target.value)} maxLength={4} />
          </div>
          <div>
            <Label className="text-xs">Balance</Label>
            <Input value={balance} onChange={e => setBalance(e.target.value)} type="number" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending}>Add</Button>
      </DialogFooter>
    </DialogContent>
  );
}