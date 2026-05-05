/**
 * C1 — Diagnostic Signals card.
 *
 * Renders only when the client has at least one undismissed diagnostic signal.
 * Currently handles signal_type='furnisher_rename'; new signal types from C2+
 * can be added as additional groups below.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import {
  useDiagnosticSignals,
  useDismissDiagnosticSignal,
  useAutoDetectFurnisherRenames,
  useAutoDetectPostRoundNewHarm,
} from '@/hooks/useDiagnosticSignals';
import { useTradelines } from '@/hooks/useTradelines';
import { useDisputeRounds } from '@/hooks/useDisputeRounds';
import type {
  DiagnosticSignal,
  FurnisherRenameSubjectIds,
  FurnisherRenameEvidence,
  PostRoundNewHarmSubjectIds,
  PostRoundNewHarmEvidence,
  Tradeline,
  DisputeRound,
} from '@/types/operator';

interface Props {
  clientId: string;
}

export function DiagnosticSignalsCard({ clientId }: Props) {
  // Kick off detection on first mount + whenever underlying tradelines change.
  useAutoDetectFurnisherRenames(clientId);
  useAutoDetectPostRoundNewHarm(clientId);

  const { data: signals = [] } = useDiagnosticSignals(clientId);
  const { data: tradelines = [] } = useTradelines(clientId);
  const { data: rounds = [] } = useDisputeRounds(clientId);
  const dismiss = useDismissDiagnosticSignal();

  const undismissed = useMemo(
    () => signals.filter(s => !s.dismissed_at),
    [signals]
  );

  if (undismissed.length === 0) return null;

  const tlById = new Map(tradelines.map(t => [t.id, t] as const));
  const roundById = new Map(rounds.map(r => [r.id, r] as const));

  const renameSignals = undismissed.filter(s => s.signal_type === 'furnisher_rename');
  const harmSignals = undismissed.filter(s => s.signal_type === 'post_round_new_harm');

  return (
    <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Diagnostic Signals
          <Badge variant="secondary" className="text-[10px]">{undismissed.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {renameSignals.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Possible furnisher substitution
            </div>
            {renameSignals.map(sig => (
              <RenameSignalRow
                key={sig.id}
                signal={sig}
                tlById={tlById}
                onDismiss={() => dismiss.mutate({ id: sig.id, clientId })}
              />
            ))}
          </div>
        )}
        {harmSignals.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Post-round new harm
            </div>
            {harmSignals.map(sig => (
              <HarmSignalRow
                key={sig.id}
                signal={sig}
                tlById={tlById}
                roundById={roundById}
                onDismiss={() => dismiss.mutate({ id: sig.id, clientId })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RenameSignalRow({
  signal, tlById, onDismiss,
}: {
  signal: DiagnosticSignal;
  tlById: Map<string, Tradeline>;
  onDismiss: () => void;
}) {
  const subj = signal.subject_ids as FurnisherRenameSubjectIds;
  const ev = signal.evidence as FurnisherRenameEvidence;
  const tOld = tlById.get(subj.tradeline_old);
  const tNew = tlById.get(subj.tradeline_new);
  const oldName = tOld?.display_name || ev.old_display_name || 'unknown';
  const newName = tNew?.display_name || ev.new_display_name || 'unknown';

  return (
    <div className="border rounded-md p-2.5 bg-background">
      <div className="text-sm">
        <Badge variant="outline" className="text-[10px] mr-2 capitalize">{subj.bureau}</Badge>
        <span className="font-medium">"{oldName}"</span>
        <span className="text-muted-foreground"> deleted, </span>
        <span className="font-medium">"{newName}"</span>
        <span className="text-muted-foreground"> appears with matching account/dates/balance.</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
        {ev.matched_account_last4 && <span>account …{ev.matched_account_last4}</span>}
        {ev.opened_date_delta_days != null && <span>opened ±{ev.opened_date_delta_days}d</span>}
        {ev.balance_delta_pct != null && <span>balance Δ {(ev.balance_delta_pct * 100).toFixed(1)}%</span>}
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}

function HarmSignalRow({
  signal, tlById, roundById, onDismiss,
}: {
  signal: DiagnosticSignal;
  tlById: Map<string, Tradeline>;
  roundById: Map<string, DisputeRound>;
  onDismiss: () => void;
}) {
  const subj = signal.subject_ids as PostRoundNewHarmSubjectIds;
  const ev = signal.evidence as PostRoundNewHarmEvidence;
  const tl = tlById.get(subj.tradeline_id);
  const round = roundById.get(subj.round_id);
  const name = tl?.display_name || ev.display_name || 'unknown tradeline';
  const roundNum = round?.round_number ?? ev.round_number;
  const openedDate = ev.opened_date || 'unknown';

  return (
    <div className="border rounded-md p-2.5 bg-background border-orange-300">
      <div className="text-sm">
        <Badge variant="outline" className="text-[10px] mr-2 border-orange-400 text-orange-700">
          Round {roundNum}
        </Badge>
        <span className="font-medium">"{name}"</span>
        <span className="text-muted-foreground">
          {' '}appeared on file {ev.days_after_round_submission} day
          {ev.days_after_round_submission === 1 ? '' : 's'} after Round {roundNum} submission,
          but the underlying account opened {openedDate}. Likely a pre-existing item
          not disputed in Round {roundNum}, or potential furnisher retaliation.
        </span>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // Placeholder for C5 — escalation letter generation.
            // eslint-disable-next-line no-alert
            alert(`Draft Round ${(roundNum ?? 1) + 1} escalation — coming in C5`);
          }}
        >
          Draft Round {(roundNum ?? 1) + 1} escalation
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}