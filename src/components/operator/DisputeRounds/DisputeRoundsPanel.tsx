import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers, Plus, Pencil, Mail, Lock, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  DisputeRound,
  DisputeRoundStatus,
  DISPUTE_ROUND_STATUSES,
  DISPUTE_ROUND_STATUS_LABELS,
  TimelineEvent,
} from '@/types/operator';
import {
  useDisputeRounds,
  useCreateDisputeRound,
  useUpdateDisputeRound,
} from '@/hooks/useDisputeRounds';
import { UnresolvedItem } from '@/types/parser';
import { toast } from 'sonner';

interface Props {
  clientId: string;
  events: TimelineEvent[];
  unresolvedItems?: UnresolvedItem[];
}

const STATUS_VARIANT: Record<DisputeRoundStatus, 'default' | 'secondary' | 'outline'> = {
  planning: 'outline',
  mailed: 'secondary',
  awaiting_response: 'secondary',
  response_received: 'default',
  closed: 'outline',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return format(parseISO(d), 'MMM d, yyyy');
  } catch {
    return d;
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DisputeRoundsPanel({ clientId, events, unresolvedItems = [] }: Props) {
  const { data: rounds = [], isLoading } = useDisputeRounds(clientId);
  const createRound = useCreateDisputeRound();
  const updateRound = useUpdateDisputeRound();
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const statsByRound = useMemo(() => {
    const m = new Map<
      string,
      { actions: number; responses: number; outcomes: number; unresolved: number }
    >();
    for (const r of rounds) {
      m.set(r.id, { actions: 0, responses: 0, outcomes: 0, unresolved: 0 });
    }
    for (const ev of events) {
      if (!ev.round_id) continue;
      const s = m.get(ev.round_id);
      if (!s) continue;
      if (ev.category === 'Action') s.actions++;
      else if (ev.category === 'Response') s.responses++;
      else if (ev.category === 'Outcome') s.outcomes++;
    }
    // Unresolved items live in memory and may not have round_id; only count when present.
    for (const it of unresolvedItems) {
      const rn = (it as any).round_number as number | undefined;
      if (!rn) continue;
      const round = rounds.find(r => r.round_number === rn);
      if (!round) continue;
      const s = m.get(round.id);
      if (s) s.unresolved++;
    }
    return m;
  }, [events, unresolvedItems, rounds]);

  const handleAddRound = () => {
    const next = (rounds.reduce((max, r) => Math.max(max, r.round_number), 0) || 0) + 1;
    createRound.mutate(
      { client_id: clientId, round_number: next, status: 'planning' },
      { onSuccess: () => toast.success(`Round ${next} created`) }
    );
  };

  const handleStatusChange = (round: DisputeRound, status: DisputeRoundStatus) => {
    const updates: Partial<DisputeRound> = { status };
    if (status === 'mailed' && !round.submitted_at) {
      (updates as any).submitted_at = todayISO();
    }
    if (status === 'closed' && !round.completed_at) {
      (updates as any).completed_at = todayISO();
    }
    updateRound.mutate({ id: round.id, clientId, updates: updates as any });
  };

  const startEditingNotes = (round: DisputeRound) => {
    setEditingNotesId(round.id);
    setNotesDraft(round.notes ?? '');
  };

  const saveNotes = (round: DisputeRound) => {
    updateRound.mutate(
      { id: round.id, clientId, updates: { notes: notesDraft || null } },
      {
        onSuccess: () => {
          setEditingNotesId(null);
          toast.success('Notes saved');
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Dispute Rounds {rounds.length > 0 && `(${rounds.length})`}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleAddRound} disabled={createRound.isPending}>
            <Plus className="h-3 w-3 mr-1" />
            New Round
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rounds…</p>
        ) : rounds.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">No dispute rounds yet.</p>
            <p className="text-xs text-muted-foreground">
              Use <code className="px-1 rounded bg-muted">[Round 1]</code> tags in ChatGPT
              imports to attach events to a round, or click <strong>New Round</strong>.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rounds.map(round => {
              const stats = statsByRound.get(round.id) || {
                actions: 0,
                responses: 0,
                outcomes: 0,
                unresolved: 0,
              };
              const isEditing = editingNotesId === round.id;
              return (
                <div
                  key={round.id}
                  className="rounded-lg border bg-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold">Round {round.round_number}</span>
                    </div>
                    <Badge variant={STATUS_VARIANT[round.status]} className="text-xs">
                      {DISPUTE_ROUND_STATUS_LABELS[round.status]}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>Submitted: {fmtDate(round.submitted_at)}</div>
                    <div>Completed: {fmtDate(round.completed_at)}</div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Stat label="Actions" value={stats.actions} />
                    <Stat label="Responses" value={stats.responses} />
                    <Stat label="Outcomes" value={stats.outcomes} />
                    <Stat label="Open" value={stats.unresolved} />
                  </div>

                  {/* Notes */}
                  <div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesDraft}
                          onChange={e => setNotesDraft(e.target.value)}
                          rows={3}
                          className="text-sm"
                          placeholder="Round narrative…"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveNotes(round)}>
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingNotesId(null)}
                          >
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="text-sm text-muted-foreground flex-1 whitespace-pre-wrap">
                          {round.notes || (
                            <span className="italic">No notes for this round.</span>
                          )}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditingNotes(round)}
                          className="h-7 w-7 p-0"
                          aria-label="Edit notes"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Status transition controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                    <Select
                      value={round.status}
                      onValueChange={v => handleStatusChange(round, v as DisputeRoundStatus)}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1 min-w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISPUTE_ROUND_STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {DISPUTE_ROUND_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {round.status !== 'mailed' && round.status !== 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(round, 'mailed')}
                        className="h-8 text-xs"
                      >
                        <Mail className="h-3 w-3 mr-1" /> Mark mailed
                      </Button>
                    )}
                    {round.status !== 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(round, 'closed')}
                        className="h-8 text-xs"
                      >
                        <Lock className="h-3 w-3 mr-1" /> Mark closed
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-lg font-semibold leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}