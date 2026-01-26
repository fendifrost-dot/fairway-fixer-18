import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DeadlineBadge, EntityBadge } from '@/components/ui/StatusBadge';
import { mockDeadlines, mockMatters, mockEntityCases } from '@/data/mockData';
import { 
  Clock, 
  Search, 
  Filter,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { format, differenceInDays, differenceInBusinessDays, isPast, isToday, isFuture } from 'date-fns';
import { cn } from '@/lib/utils';
import { DEADLINE_LABELS, DeadlineStatus } from '@/types/workflow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Deadlines() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const filteredDeadlines = mockDeadlines
    .filter(deadline => {
      const matterTitle = getMatterTitle(deadline.matterId);
      const entityName = getEntityName(deadline.entityCaseId);
      const matchesSearch = 
        matterTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        DEADLINE_LABELS[deadline.deadlineType].toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && deadline.status !== 'Closed') ||
        deadline.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort overdue first, then by due date
      const aOverdue = isPast(a.dueDate) && !isToday(a.dueDate);
      const bOverdue = isPast(b.dueDate) && !isToday(b.dueDate);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

  function getMatterTitle(matterId: string) {
    const matter = mockMatters.find(m => m.id === matterId);
    return matter?.title || 'Unknown Matter';
  }

  function getEntityName(entityCaseId: string) {
    const entity = mockEntityCases.find(e => e.id === entityCaseId);
    return entity?.entityName || 'Unknown Entity';
  }

  function getEntityType(entityCaseId: string) {
    const entity = mockEntityCases.find(e => e.id === entityCaseId);
    return entity?.entityType;
  }

  // Group by status
  const overdueDeadlines = filteredDeadlines.filter(d => d.status === 'Overdue' || (isPast(d.dueDate) && !isToday(d.dueDate)));
  const dueSoonDeadlines = filteredDeadlines.filter(d => d.status === 'DueSoon' && !isPast(d.dueDate));
  const upcomingDeadlines = filteredDeadlines.filter(d => d.status === 'Open' && isFuture(d.dueDate));

  const renderDeadlineGroup = (
    title: string, 
    deadlines: typeof filteredDeadlines, 
    icon: React.ReactNode,
    variant: 'danger' | 'warning' | 'default'
  ) => {
    if (deadlines.length === 0) return null;
    
    const borderClass = variant === 'danger' ? 'border-l-4 border-l-state-violation' :
                        variant === 'warning' ? 'border-l-4 border-l-state-active' : '';

    return (
      <Card className={cn("card-elevated", borderClass)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            <span>{title}</span>
            <span className="text-sm text-muted-foreground font-normal">
              ({deadlines.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {deadlines.map(deadline => {
              const daysRemaining = differenceInDays(deadline.dueDate, new Date());
              const businessDays = differenceInBusinessDays(deadline.dueDate, new Date());
              const entityType = getEntityType(deadline.entityCaseId);
              
              return (
                <div
                  key={deadline.id}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className={cn(
                    "mt-1 p-2 rounded-lg",
                    isPast(deadline.dueDate) ? "bg-state-violation/10" :
                    daysRemaining <= 3 ? "bg-state-active/10" :
                    "bg-secondary"
                  )}>
                    <Calendar className={cn(
                      "h-4 w-4",
                      isPast(deadline.dueDate) ? "text-state-violation" :
                      daysRemaining <= 3 ? "text-state-active" :
                      "text-muted-foreground"
                    )} />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">
                        {DEADLINE_LABELS[deadline.deadlineType]}
                      </p>
                      <DeadlineBadge 
                        status={deadline.status} 
                        daysRemaining={Math.abs(daysRemaining)} 
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {entityType && <EntityBadge type={entityType} size="sm" />}
                      <span className="text-xs text-muted-foreground">
                        {getEntityName(deadline.entityCaseId)}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {getMatterTitle(deadline.matterId)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Started: {format(deadline.startDate, 'MMM d, yyyy')}</span>
                      <span>Due: {format(deadline.dueDate, 'MMM d, yyyy')}</span>
                      {!isPast(deadline.dueDate) && (
                        <span className="font-medium">
                          {businessDays} business day{businessDays !== 1 ? 's' : ''} remaining
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Clock className="h-8 w-8 text-accent" />
          Deadlines
        </h1>
        <p className="text-muted-foreground mt-1">
          Track statutory and regulatory deadlines
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by matter, entity, or deadline type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="DueSoon">Due Soon</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deadline Groups */}
      <div className="space-y-6">
        {renderDeadlineGroup(
          'Overdue',
          overdueDeadlines,
          <AlertCircle className="h-5 w-5 text-state-violation" />,
          'danger'
        )}

        {renderDeadlineGroup(
          'Due Soon',
          dueSoonDeadlines,
          <Clock className="h-5 w-5 text-state-active" />,
          'warning'
        )}

        {renderDeadlineGroup(
          'Upcoming',
          upcomingDeadlines,
          <Calendar className="h-5 w-5 text-muted-foreground" />,
          'default'
        )}
      </div>

      {filteredDeadlines.length === 0 && (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No deadlines found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
