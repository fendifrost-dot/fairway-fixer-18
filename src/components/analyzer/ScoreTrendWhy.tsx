/**
 * C4 — Inline "Why?" attribution for a per-bureau score delta.
 *
 * Pure UI: receives a precomputed ScoreTrendInterpretation. Shows top 3
 * drivers as a collapsible inline list and a Popover with the full attribution
 * detail. Disclaimer made explicit — heuristic, not FICO math.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { ScoreTrendInterpretation, ScoreAttribution } from '@/types/operator';

function fmtPts(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : '±';
  return `${sign}${n}`;
}

function ptsClass(n: number): string {
  if (n > 0) return 'text-emerald-600';
  if (n < 0) return 'text-red-600';
  return 'text-muted-foreground';
}

function focusSignal(signalId: string) {
  window.dispatchEvent(
    new CustomEvent('guardian:focus-signal', { detail: { signalId } })
  );
}

function AttributionLine({ a }: { a: ScoreAttribution }) {
  const clickable = !!a.signal_id;
  return (
    <li className="flex items-start gap-2 text-[12px] leading-snug">
      <span className={`font-medium tabular-nums w-9 shrink-0 ${ptsClass(a.est_pts)}`}>
        {fmtPts(a.est_pts)}
      </span>
      {clickable ? (
        <button
          className="text-left text-foreground hover:underline"
          onClick={() => focusSignal(a.signal_id!)}
          title="Jump to diagnostic signal"
        >
          {a.label}
        </button>
      ) : (
        <span className="text-foreground">{a.label}</span>
      )}
    </li>
  );
}

export function ScoreTrendWhy({ interp }: { interp: ScoreTrendInterpretation | null }) {
  const [open, setOpen] = useState(false);

  if (!interp || interp.delta == null || interp.attributions.length === 0) return null;

  const top = interp.attributions.slice(0, 3);
  const hasMore = interp.attributions.length > top.length;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
      >
        Why?
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1.5 text-left space-y-1">
          <ul className="space-y-1">
            {top.map((a, i) => (
              <AttributionLine key={i} a={a} />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-muted-foreground italic">
              Estimated drivers — actual FICO calculations differ
            </p>
            {hasMore && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                    <Info className="h-3 w-3 mr-1" />
                    All {interp.attributions.length}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <div className="text-xs font-medium mb-2 capitalize">
                    {interp.bureau} — {interp.prior_score} → {interp.current_score}{' '}
                    <span className={ptsClass(interp.delta)}>({fmtPts(interp.delta)})</span>
                  </div>
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {interp.attributions.map((a, i) => (
                      <AttributionLine key={i} a={a} />
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-muted-foreground italic">
                    Heuristic attribution. Actual FICO calculations differ.
                  </p>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}
    </div>
  );
}