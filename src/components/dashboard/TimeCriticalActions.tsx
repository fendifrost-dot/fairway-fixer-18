import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PriorityBadge, EntityBadge, StateBadge } from '@/components/ui/StatusBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { mockTasks, mockDeadlines, mockMatters, mockEntityCases } from '@/data/mockData';
import { DEADLINE_LABELS, MatterState, DeadlineType } from '@/types/workflow';
import { cn } from '@/lib/utils';
import { ArrowRight, Clock, AlertOctagon, Info } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

// Legal basis for different deadline types
const LEGAL_BASIS: Record<DeadlineType, { statute: string; description: string }> = {
  '611_30day': {
    statute: '§611(a)(1)',
    description: 'CRA must complete reinvestigation within 30 days of dispute receipt.',
  },
  '611_notice': {
    statute: '§611(a)(6)',
    description: 'CRA must provide written notice of results within 5 business days of completion.',
  },
  '605B_4biz': {
    statute: '§605B',
    description: 'CRA must block identity theft information within 4 business days.',
  },
  'Reinsertion_5biz': {
    statute: '§611(a)(5)(B)',
    description: 'CRA may only reinsert with furnisher certification and 5-day consumer notice.',
  },
  'CFPB_15': {
    statute: 'CFPB Rule',
    description: 'Company must respond to CFPB complaint within 15 calendar days.',
  },
  'CFPB_60': {
    statute: 'CFPB Rule',
    description: 'Company must resolve CFPB complaint within 60 calendar days.',
  },
  'FollowUp': {
    statute: 'Operational',
    description: 'Internal follow-up action required.',
  },
};

interface TimeCriticalActionsProps {
  stateFilter: MatterState | null;
}

export function TimeCriticalActions({ stateFilter }: TimeCriticalActionsProps) {
  // Combine tasks and deadlines into unified actions
  const pendingTasks = mockTasks
    .filter(t => t.status !== 'Done')
    .map(task => {
      const matter = mockMatters.find(m => m.id === task.matterId);
      const entity = task.entityCaseId 
        ? mockEntityCases.find(e => e.id === task.entityCaseId)
        : null;
      
      return {
        id: task.id,
        type: 'task' as const,
        name: task.taskType,
        matter,
        entity,
        priority: task.priority,
        dueDate: task.dueDate,
        legalBasis: null as { statute: string; description: string } | null,
      };
    });

  const activeDeadlines = mockDeadlines
    .filter(d => d.status !== 'Closed')
    .map(deadline => {
      const matter = mockMatters.find(m => m.id === deadline.matterId);
      const entity = mockEntityCases.find(e => e.id === deadline.entityCaseId);
      
      // Determine priority based on deadline type and urgency
      const daysRemaining = differenceInDays(deadline.dueDate, new Date());
      let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P2';
      if (deadline.deadlineType.includes('611') || deadline.deadlineType.includes('605B') || deadline.deadlineType.includes('Reinsertion')) {
        priority = daysRemaining < 0 ? 'P0' : daysRemaining <= 3 ? 'P0' : 'P1';
      } else if (deadline.deadlineType.includes('CFPB')) {
        priority = daysRemaining < 0 ? 'P0' : 'P1';
      }

      return {
        id: deadline.id,
        type: 'deadline' as const,
        name: DEADLINE_LABELS[deadline.deadlineType],
        matter,
        entity,
        priority,
        dueDate: deadline.dueDate,
        legalBasis: LEGAL_BASIS[deadline.deadlineType],
      };
    });

  // Combine and sort by priority, then by due date
  let allActions = [...pendingTasks, ...activeDeadlines].sort((a, b) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  // Apply state filter
  if (stateFilter) {
    allActions = allActions.filter(action => action.matter?.primaryState === stateFilter);
  }

  const formatCountdown = (date: Date | undefined) => {
    if (!date) return '—';
    const days = differenceInDays(date, new Date());
    if (days < 0) return `D+${Math.abs(days)}`;
    if (days === 0) return 'D-0';
    return `D-${days}`;
  };

  const getCountdownStyle = (date: Date | undefined) => {
    if (!date) return '';
    const days = differenceInDays(date, new Date());
    if (days < 0) return 'text-[hsl(var(--state-violation))] font-bold';
    if (days === 0) return 'text-[hsl(var(--state-violation))] font-bold animate-pulse';
    if (days <= 2) return 'text-[hsl(var(--state-active))] font-semibold';
    if (days <= 5) return 'text-[hsl(var(--state-active))]';
    return 'text-muted-foreground';
  };

  return (
    <TooltipProvider>
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-[hsl(var(--state-violation))]" />
            Time-Critical Actions
            {stateFilter && (
              <span className="text-sm font-normal text-muted-foreground">
                — Filtered by state
              </span>
            )}
          </CardTitle>
          <Link 
            to="/tasks" 
            className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 font-medium"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {allActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No time-critical actions {stateFilter ? 'for this state filter' : 'pending'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Priority</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Matter</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="w-[100px]">Legal Basis</TableHead>
                  <TableHead className="w-[80px] text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allActions.slice(0, 12).map((action) => {
                  const days = action.dueDate ? differenceInDays(action.dueDate, new Date()) : null;
                  const isOverdue = days !== null && days < 0;
                  
                  return (
                    <TableRow 
                      key={action.id} 
                      className={cn(
                        "group",
                        isOverdue && "bg-[hsl(var(--state-violation))]/5"
                      )}
                    >
                      <TableCell>
                        <PriorityBadge priority={action.priority} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium",
                            action.type === 'deadline' && "text-foreground"
                          )}>
                            {action.name}
                          </span>
                          {action.type === 'deadline' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                              Deadline
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm truncate max-w-[150px]">
                            {action.matter?.title || 'Unknown'}
                          </span>
                          {action.matter && (
                            <StateBadge state={action.matter.primaryState} size="sm" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {action.entity ? (
                          <div className="flex items-center gap-1.5">
                            <EntityBadge type={action.entity.entityType} size="sm" />
                            <span className="text-sm text-muted-foreground">
                              {action.entity.entityName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {action.legalBasis ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-xs font-mono bg-secondary px-1.5 py-0.5 rounded cursor-help">
                                {action.legalBasis.statute}
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="font-semibold mb-1">{action.legalBasis.statute}</p>
                              <p className="text-sm text-muted-foreground">
                                {action.legalBasis.description}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={cn(
                            "text-sm font-mono",
                            getCountdownStyle(action.dueDate)
                          )}>
                            {formatCountdown(action.dueDate)}
                          </span>
                          {action.dueDate && (
                            <span className="text-xs text-muted-foreground">
                              {format(action.dueDate, 'MMM d')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
