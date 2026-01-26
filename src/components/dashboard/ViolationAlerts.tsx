import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useViolations } from '@/hooks/useDashboardData';
import { AlertTriangle, ArrowRight, ShieldAlert, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { DashboardFilters, ViolationTrigger } from '@/types/database';

const triggerLabels: Record<ViolationTrigger, string> = {
  Missed611Deadline: 'Missed §611 Deadline',
  Reinsertion611a5B: 'Reinsertion §611(a)(5)(B)',
  Failure605B: 'Failure §605B',
  NoMOV: 'No Method of Verification',
  Boilerplate: 'Boilerplate Response',
};

interface ViolationAlertsProps {
  filters?: DashboardFilters;
}

export function ViolationAlerts({ filters }: ViolationAlertsProps) {
  const { data: violations = [], isLoading } = useViolations(filters);

  const recentViolations = violations
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  const getSeverityStyle = (severity: number) => {
    if (severity >= 4) return 'bg-[hsl(var(--state-violation))]/15 border-[hsl(var(--state-violation))]/30 text-[hsl(var(--state-violation))]';
    if (severity >= 3) return 'bg-[hsl(var(--state-active))]/15 border-[hsl(var(--state-active))]/30 text-[hsl(var(--state-active))]';
    return 'bg-secondary border-border text-foreground';
  };

  return (
    <Card className="card-elevated border-l-4 border-l-[hsl(var(--state-violation))]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[hsl(var(--state-violation))]" />
          Recent Violations
        </CardTitle>
        <Link 
          to="/violations" 
          className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 font-medium"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentViolations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No violations recorded
          </div>
        ) : (
          <div className="space-y-3">
            {recentViolations.map((violation) => (
              <div
                key={violation.id}
                className={cn(
                  "p-3 rounded-lg border",
                  getSeverityStyle(violation.severity)
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">
                        {triggerLabels[violation.trigger] || violation.trigger}
                      </p>
                      <span className="text-xs font-mono opacity-70">
                        {violation.statutory_section}
                      </span>
                    </div>
                    <p className="text-xs opacity-80">
                      <Link 
                        to={`/clients/${violation.matter?.client_id}`}
                        className="hover:underline"
                      >
                        {violation.matter?.client?.preferred_name || violation.matter?.client?.legal_name}
                      </Link>
                      {' • '}
                      <Link 
                        to={`/matters/${violation.matter_id}`}
                        className="hover:underline"
                      >
                        {violation.matter?.title}
                      </Link>
                      {violation.entity_case && (
                        <>
                          {' • '}
                          {violation.entity_case.entity_name}
                        </>
                      )}
                    </p>
                    <p className="text-xs opacity-60 mt-1">
                      {format(parseISO(violation.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold",
                    violation.severity >= 4 ? "bg-[hsl(var(--state-violation))] text-white" :
                    violation.severity >= 3 ? "bg-[hsl(var(--state-active))] text-white" :
                    "bg-secondary text-foreground"
                  )}>
                    S{violation.severity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
