import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockViolations, mockMatters, mockEntityCases } from '@/data/mockData';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const triggerLabels: Record<string, string> = {
  Missed611Deadline: 'Missed §611 Deadline',
  Reinsertion611a5B: 'Reinsertion §611(a)(5)(B)',
  Failure605B: 'Failure §605B',
  NoMOV: 'No Method of Verification',
  Boilerplate: 'Boilerplate Response',
};

export function ViolationAlerts() {
  const recentViolations = mockViolations
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 4);

  const getMatterTitle = (matterId: string) => {
    const matter = mockMatters.find(m => m.id === matterId);
    return matter?.title || 'Unknown Matter';
  };

  const getEntityName = (entityCaseId: string) => {
    const entity = mockEntityCases.find(e => e.id === entityCaseId);
    return entity?.entityName || 'Unknown Entity';
  };

  const getSeverityStyle = (severity: number) => {
    if (severity >= 4) return 'bg-state-violation/15 border-state-violation/30 text-state-violation';
    if (severity >= 3) return 'bg-state-active/15 border-state-active/30 text-state-active';
    return 'bg-secondary border-border text-foreground';
  };

  return (
    <Card className="card-elevated border-l-4 border-l-state-violation">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-state-violation" />
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
                      {violation.statutorySection}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 truncate">
                    {getEntityName(violation.entityCaseId)} • {getMatterTitle(violation.matterId)}
                  </p>
                  <p className="text-xs opacity-60 mt-1">
                    {format(violation.createdAt, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold",
                  violation.severity >= 4 ? "bg-state-violation text-white" :
                  violation.severity >= 3 ? "bg-state-active text-white" :
                  "bg-secondary text-foreground"
                )}>
                  S{violation.severity}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
