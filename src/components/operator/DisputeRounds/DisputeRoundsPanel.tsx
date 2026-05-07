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
import { Layers, Plus, Pencil, Mail, Lock, Check, X, AlertTriangle, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  DisputeRound,
  DisputeRoundStatus,
  DISPUTE_ROUND_STATUSES,
  DISPUTE_ROUND_STATUS_LABELS,
  TimelineEvent,
  DiagnosticSignal,
  PostRoundNewHarmSubjectIds,
  PostRoundNewHarmEvidence,
} from '@/types/operator';
import {
  useDisputeRounds,
  useCreateDisputeRound,
  useUpdateDisputeRound,
} from '@/hooks/useDisputeRounds';
import { useDiagnosticSignals } from '@/hooks/useDiagnosticSignals';
import { useTradelines } from '@/hooks/useTradelines';
import { useTradelineBureauStates } from '@/hooks/useTradelines';
import { useGenerateDisputeLetter } from '@/hooks/useGenerateDisputeLetter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { suggestLetterTypeForRound } from '@/lib/disputeLetters/routing';
import {
  DISPUTE_LETTER_TYPE_LABELS,
  type DisputeLetterType,
} from '@/lib/disputeLetters/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const { data: signals = [] } = useDiagnosticSignals(clientId);
  const { data: tradelines = [] } = useTradelines(clientId);
  const { data: bureauStates = [] } = useTradelineBureauStates(clientId);
  const generate = useGenerateDisputeLetter();
  const createRound = useCreateDisputeRound();
  const updateRound = useUpdateDisputeRound();
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const harmSignalsByRound = useMemo(() => {
    const m = new Map<string, DiagnosticSignal[]>();
    for (const s of signals) {
      if (s.dismissed_at) continue;
      if (s.signal_type !== 'post_round_new_harm') continue;
      const subj = s.subject_ids as PostRoundNewHarmSubjectIds;
      if (!subj.round_id) continue;
      const arr = m.get(subj.round_id) || [];
      arr.push(s);
      m.set(subj.round_id, arr);
    }
    return m;
  }, [signals]);
  const tlNameById = useMemo(
    () => new Map(tradelines.map(t => [t.id, t.display_name] as const)),
    [tradelines]
  );

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
              const harmSignals = harmSignalsByRound.get(round.id) || [];
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

                  {harmSignals.length > 0 && (
                    <PostRoundHarmAlert signals={harmSignals} tlNameById={tlNameById} />
                  )}

                  <DraftLettersMenu
                    clientId={clientId}
                    round={round}
                    signals={signals}
                    bureauStates={bureauStates}
                    onGenerate={(req) => generate.mutate(req)}
                    busy={generate.isPending}
                  />

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

const BUREAUS: Array<{ key: string; label: string }> = [
  { key: 'Experian', label: 'Experian' },
  { key: 'TransUnion', label: 'TransUnion' },
  { key: 'Equifax', label: 'Equifax' },
];

const ALL_LETTER_TYPES: DisputeLetterType[] = [
  'round_n_initial',
  'verify_or_delete',
  'overdue_violation',
  'data_broker_followup',
];

function DraftLettersMenu({
  clientId,
  round,
  signals,
  bureauStates,
  onGenerate,
  busy,
}: {
  clientId: string;
  round: DisputeRound;
  signals: DiagnosticSignal[];
  bureauStates: Array<{ tradeline_id: string; bureau: string; present: boolean; status_on_bureau: string | null }>;
  onGenerate: (req: { client_id: string; round_number: number; letter_type: DisputeLetterType; bureau?: string }) => void;
  busy: boolean;
}) {
  const undismissed = signals.filter(s => !s.dismissed_at);
  const hasArv = undismissed.some(s => s.signal_type === 'automated_reverification');
  const hasRename = undismissed.some(s => s.signal_type === 'furnisher_rename');
  const hasNewHarm = undismissed.some(
    s => s.signal_type === 'post_round_new_harm' &&
      (s.subject_ids as any)?.round_id === round.id
  );
  const verifiedTokens = ['verified', 'updated', 'no change', 'confirmed'];
  const hasVerifiedItems = bureauStates.some(s => {
    const st = (s.status_on_bureau || '').toLowerCase();
    return verifiedTokens.some(t => st.includes(t));
  });
  const suggested = suggestLetterTypeForRound({
    round: { status: round.status, submitted_at: round.submitted_at },
    hasVerifiedItems,
    hasAutomatedReverificationSignal: hasArv,
    hasFurnisherRenameSignal: hasRename,
    hasPostRoundNewHarmSignal: hasNewHarm,
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy} className="w-full h-8 text-xs">
          <Mail className="h-3 w-3 mr-1" /> Draft letters
          <ChevronDown className="h-3 w-3 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">
          Suggested: {DISPUTE_LETTER_TYPE_LABELS[suggested]}
        </DropdownMenuLabel>
        {BUREAUS.map(b => (
          <div key={b.key}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {b.label}
            </DropdownMenuLabel>
            {ALL_LETTER_TYPES.map(t => (
              <DropdownMenuItem
                key={`${b.key}-${t}`}
                onClick={() =>
                  onGenerate({
                    client_id: clientId,
                    round_number: round.round_number,
                    letter_type: t,
                    bureau: b.key,
                  })
                }
                className="text-xs"
              >
                {DISPUTE_LETTER_TYPE_LABELS[t]}
                {t === suggested && <Badge variant="secondary" className="ml-auto text-[9px]">suggested</Badge>}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PostRoundHarmAlert({
  signals,
  tlNameById,
}: {
  signals: DiagnosticSignal[];
  tlNameById: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/10">
        <CollapsibleTrigger className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left">
          <span className="text-xs font-medium text-orange-800 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {signals.length} new derogatory item{signals.length === 1 ? '' : 's'} appeared post-submission
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-orange-700 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2.5 pb-2 space-y-1">
            {signals.map(sig => {
              const subj = sig.subject_ids as PostRoundNewHarmSubjectIds;
              const ev = sig.evidence as PostRoundNewHarmEvidence;
              const name = tlNameById.get(subj.tradeline_id) || ev.display_name;
              return (
                <div key={sig.id} className="text-xs">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground">
                    {' '}— opened {ev.opened_date || 'unknown'} · +{ev.days_after_round_submission}d
                  </span>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}