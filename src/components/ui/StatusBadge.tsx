import { cn } from '@/lib/utils';
import { MatterState, Priority, OverlayType, EntityType, DeadlineStatus } from '@/types/workflow';

interface StateProps {
  state: MatterState;
  size?: 'sm' | 'md';
}

const stateStyles: Record<MatterState, string> = {
  Intake: 'badge-state-intake',
  DisputePreparation: 'badge-state-intake',
  DisputeActive: 'badge-state-active',
  PartialCompliance: 'badge-state-partial',
  ViolationConfirmed: 'badge-state-violation',
  ReinsertionDetected: 'badge-state-reinsertion',
  RegulatoryReview: 'badge-state-regulatory',
  Blocked: 'bg-state-blocked text-white',
  FurnisherLiabilityTrack: 'bg-state-furnisher text-white',
  EscalationEligible: 'bg-state-escalation text-white',
  LitigationReady: 'badge-state-litigation',
  Resolved: 'badge-state-resolved',
};

const stateLabels: Record<MatterState, string> = {
  Intake: 'Intake',
  DisputePreparation: 'Prep',
  DisputeActive: 'Active',
  PartialCompliance: 'Partial',
  ViolationConfirmed: 'Violation',
  ReinsertionDetected: 'Reinsertion',
  RegulatoryReview: 'Regulatory',
  Blocked: 'Blocked',
  FurnisherLiabilityTrack: 'Furnisher',
  EscalationEligible: 'Escalation',
  LitigationReady: 'Litigation',
  Resolved: 'Resolved',
};

export function StateBadge({ state, size = 'md' }: StateProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      size === 'sm' ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      stateStyles[state]
    )}>
      {stateLabels[state]}
    </span>
  );
}

interface PriorityProps {
  priority: Priority;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ priority, size = 'md' }: PriorityProps) {
  const styles: Record<Priority, string> = {
    P0: 'badge-priority-p0',
    P1: 'badge-priority-p1',
    P2: 'badge-priority-p2',
    P3: 'badge-priority-p3',
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded font-mono",
      size === 'sm' ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs",
      styles[priority]
    )}>
      {priority}
    </span>
  );
}

interface OverlayProps {
  overlay: OverlayType;
  size?: 'sm' | 'md';
}

const overlayStyles: Record<OverlayType, string> = {
  IdentityTheftDocumented: 'bg-overlay-identityTheft/15 text-overlay-identityTheft border border-overlay-identityTheft/30',
  MixedFileConfirmed: 'bg-overlay-mixedFile/15 text-overlay-mixedFile border border-overlay-mixedFile/30',
  UpstreamContainmentActive: 'bg-overlay-upstream/15 text-overlay-upstream border border-overlay-upstream/30',
};

const overlayLabels: Record<OverlayType, string> = {
  IdentityTheftDocumented: 'ID Theft',
  MixedFileConfirmed: 'Mixed File',
  UpstreamContainmentActive: 'Upstream',
};

export function OverlayBadge({ overlay, size = 'md' }: OverlayProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      size === 'sm' ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      overlayStyles[overlay]
    )}>
      {overlayLabels[overlay]}
    </span>
  );
}

interface EntityProps {
  type: EntityType;
  size?: 'sm' | 'md';
}

const entityStyles: Record<EntityType, string> = {
  CRA: 'bg-entity-cra/15 text-entity-cra',
  Furnisher: 'bg-entity-furnisher/15 text-entity-furnisher',
  DataBroker: 'bg-entity-dataBroker/15 text-entity-dataBroker',
  Agency: 'bg-entity-agency/15 text-entity-agency',
};

export function EntityBadge({ type, size = 'md' }: EntityProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded font-medium",
      size === 'sm' ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs",
      entityStyles[type]
    )}>
      {type}
    </span>
  );
}

interface DeadlineProps {
  status: DeadlineStatus;
  daysRemaining?: number;
}

export function DeadlineBadge({ status, daysRemaining }: DeadlineProps) {
  const styles: Record<DeadlineStatus, string> = {
    Open: 'bg-secondary text-foreground',
    DueSoon: 'bg-state-active/15 text-state-active',
    Overdue: 'bg-state-violation/15 text-state-violation font-semibold',
    Closed: 'bg-state-resolved/15 text-state-resolved',
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
      styles[status]
    )}>
      {status}
      {daysRemaining !== undefined && status !== 'Closed' && (
        <span className="opacity-80">
          ({daysRemaining > 0 ? `${daysRemaining}d` : 'now'})
        </span>
      )}
    </span>
  );
}
