import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeadlineBadge } from '@/components/ui/StatusBadge';
import { mockDeadlines, mockMatters, mockEntityCases } from '@/data/mockData';
import { Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { DEADLINE_LABELS } from '@/types/workflow';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function DeadlineTimeline() {
  const activeDeadlines = mockDeadlines
    .filter(d => d.status !== 'Closed')
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 5);

  const getMatterTitle = (matterId: string) => {
    const matter = mockMatters.find(m => m.id === matterId);
    return matter?.title || 'Unknown Matter';
  };

  const getEntityName = (entityCaseId: string) => {
    const entity = mockEntityCases.find(e => e.id === entityCaseId);
    return entity?.entityName || 'Unknown Entity';
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Upcoming Deadlines
        </CardTitle>
        <Link 
          to="/deadlines" 
          className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 font-medium"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
          
          <div className="space-y-4">
            {activeDeadlines.map((deadline, index) => {
              const daysRemaining = differenceInDays(deadline.dueDate, new Date());
              const isOverdue = daysRemaining < 0;
              
              return (
                <div key={deadline.id} className="relative flex gap-4 pl-6">
                  {/* Timeline dot */}
                  <div className={cn(
                    "absolute left-0 w-[15px] h-[15px] rounded-full border-2 bg-card",
                    isOverdue ? "border-state-violation" : 
                    daysRemaining <= 3 ? "border-state-active" : "border-muted-foreground"
                  )}>
                    {isOverdue && (
                      <AlertCircle className="h-2.5 w-2.5 text-state-violation absolute top-0.5 left-0.5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          isOverdue && "text-state-violation"
                        )}>
                          {DEADLINE_LABELS[deadline.deadlineType]}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getEntityName(deadline.entityCaseId)} • {getMatterTitle(deadline.matterId)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <DeadlineBadge status={deadline.status} daysRemaining={Math.abs(daysRemaining)} />
                        <span className="text-xs text-muted-foreground">
                          {format(deadline.dueDate, 'MMM d')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
