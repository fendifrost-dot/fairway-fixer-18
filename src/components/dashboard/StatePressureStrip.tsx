import { cn } from '@/lib/utils';
import { mockMatters } from '@/data/mockData';
import { MatterState } from '@/types/workflow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  RefreshCcw, 
  Scale,
  AlertCircle,
  Gavel,
  CheckCircle
} from 'lucide-react';

interface StateConfig {
  icon: React.ElementType;
  label: string;
  shortLabel: string;
  description: string;
  colorClass: string;
  bgClass: string;
  priority: number; // Lower = more urgent
}

const stateConfigs: Partial<Record<MatterState, StateConfig>> = {
  ReinsertionDetected: {
    icon: RefreshCcw,
    label: 'Reinsertion Detected',
    shortLabel: 'Reinsertion',
    description: '§611(a)(5)(B) — Immediate action required. Reinsertion without certification.',
    colorClass: 'text-[hsl(var(--state-reinsertion))]',
    bgClass: 'bg-[hsl(var(--state-reinsertion))]/15 border-[hsl(var(--state-reinsertion))]/40 hover:bg-[hsl(var(--state-reinsertion))]/25',
    priority: 1,
  },
  ViolationConfirmed: {
    icon: AlertTriangle,
    label: 'Violation Confirmed',
    shortLabel: 'Violation',
    description: 'CRA noncompliance established. CFPB/litigation pathways open.',
    colorClass: 'text-[hsl(var(--state-violation))]',
    bgClass: 'bg-[hsl(var(--state-violation))]/15 border-[hsl(var(--state-violation))]/40 hover:bg-[hsl(var(--state-violation))]/25',
    priority: 2,
  },
  LitigationReady: {
    icon: Gavel,
    label: 'Litigation Ready',
    shortLabel: 'Litigation',
    description: 'Willfulness threshold met. Evidence pack ready for counsel.',
    colorClass: 'text-[hsl(var(--state-litigation))]',
    bgClass: 'bg-[hsl(var(--state-litigation))]/15 border-[hsl(var(--state-litigation))]/40 hover:bg-[hsl(var(--state-litigation))]/25',
    priority: 3,
  },
  EscalationEligible: {
    icon: AlertCircle,
    label: 'Escalation Eligible',
    shortLabel: 'Escalation',
    description: 'BBB, AG, and litigation pathways available.',
    colorClass: 'text-[hsl(var(--state-escalation))]',
    bgClass: 'bg-[hsl(var(--state-escalation))]/15 border-[hsl(var(--state-escalation))]/40 hover:bg-[hsl(var(--state-escalation))]/25',
    priority: 4,
  },
  DisputeActive: {
    icon: Clock,
    label: 'Dispute Active',
    shortLabel: 'Active',
    description: 'Monitoring §611 30/35-day statutory deadlines.',
    colorClass: 'text-[hsl(var(--state-active))]',
    bgClass: 'bg-[hsl(var(--state-active))]/15 border-[hsl(var(--state-active))]/40 hover:bg-[hsl(var(--state-active))]/25',
    priority: 5,
  },
  PartialCompliance: {
    icon: Scale,
    label: 'Partial Compliance',
    shortLabel: 'Partial',
    description: 'Some items deleted, others remain. Heightened blocking obligations.',
    colorClass: 'text-[hsl(var(--state-partial))]',
    bgClass: 'bg-[hsl(var(--state-partial))]/15 border-[hsl(var(--state-partial))]/40 hover:bg-[hsl(var(--state-partial))]/25',
    priority: 6,
  },
  RegulatoryReview: {
    icon: FileText,
    label: 'Regulatory Review',
    shortLabel: 'Regulatory',
    description: 'CFPB complaint filed. Monitoring 15/60-day windows.',
    colorClass: 'text-[hsl(var(--state-regulatory))]',
    bgClass: 'bg-[hsl(var(--state-regulatory))]/15 border-[hsl(var(--state-regulatory))]/40 hover:bg-[hsl(var(--state-regulatory))]/25',
    priority: 7,
  },
  Resolved: {
    icon: CheckCircle,
    label: 'Resolved',
    shortLabel: 'Resolved',
    description: 'All items removed. In monitoring period.',
    colorClass: 'text-[hsl(var(--state-resolved))]',
    bgClass: 'bg-[hsl(var(--state-resolved))]/15 border-[hsl(var(--state-resolved))]/40 hover:bg-[hsl(var(--state-resolved))]/25',
    priority: 8,
  },
};

interface StatePressureStripProps {
  activeFilter: MatterState | null;
  onFilterChange: (state: MatterState | null) => void;
}

export function StatePressureStrip({ activeFilter, onFilterChange }: StatePressureStripProps) {
  // Count matters by state
  const stateCounts = mockMatters.reduce((acc, matter) => {
    acc[matter.primaryState] = (acc[matter.primaryState] || 0) + 1;
    return acc;
  }, {} as Record<MatterState, number>);

  // Sort states by priority (most urgent first)
  const sortedStates = Object.entries(stateConfigs)
    .filter(([state]) => stateCounts[state as MatterState] > 0)
    .sort((a, b) => a[1].priority - b[1].priority);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {/* Clear filter button */}
        {activeFilter && (
          <button
            onClick={() => onFilterChange(null)}
            className="px-3 py-2 rounded-lg border bg-card text-muted-foreground hover:bg-secondary transition-colors text-sm font-medium"
          >
            Clear Filter
          </button>
        )}
        
        {sortedStates.map(([state, config]) => {
          const count = stateCounts[state as MatterState];
          const Icon = config.icon;
          const isActive = activeFilter === state;
          
          return (
            <Tooltip key={state}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onFilterChange(isActive ? null : state as MatterState)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium",
                    config.bgClass,
                    isActive && "ring-2 ring-offset-2 ring-offset-background",
                    isActive && config.colorClass.replace('text-', 'ring-')
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.colorClass)} />
                  <span className={config.colorClass}>{config.shortLabel}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-bold",
                    config.colorClass.replace('text-', 'bg-'),
                    "text-white"
                  )}>
                    {count}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-semibold mb-1">{config.label}</p>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
