import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EntityBadge, StateBadge } from '@/components/ui/StatusBadge';
import { mockViolations, mockMatters, mockEntityCases } from '@/data/mockData';
import { 
  AlertTriangle, 
  Search, 
  Filter,
  FileCheck,
  Scale,
  Gavel
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ViolationTrigger } from '@/types/workflow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const triggerLabels: Record<ViolationTrigger, { label: string; description: string }> = {
  Missed611Deadline: {
    label: 'Missed §611 Deadline',
    description: 'CRA failed to complete reinvestigation within 30 days'
  },
  Reinsertion611a5B: {
    label: 'Reinsertion §611(a)(5)(B)',
    description: 'Previously deleted item reinserted without certification'
  },
  Failure605B: {
    label: 'Failure §605B',
    description: 'Failed to block identity theft items within 4 business days'
  },
  NoMOV: {
    label: 'No Method of Verification',
    description: 'Failed to provide method of verification upon request'
  },
  Boilerplate: {
    label: 'Boilerplate Response',
    description: 'Form letter response without meaningful reinvestigation'
  },
};

export default function Violations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');

  const filteredViolations = mockViolations
    .filter(violation => {
      const matterTitle = getMatterTitle(violation.matterId);
      const entityName = getEntityName(violation.entityCaseId);
      const matchesSearch = 
        matterTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        triggerLabels[violation.trigger].label.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSeverity = 
        severityFilter === 'all' || 
        violation.severity.toString() === severityFilter;
      
      const matchesTrigger =
        triggerFilter === 'all' ||
        violation.trigger === triggerFilter;
      
      return matchesSearch && matchesSeverity && matchesTrigger;
    })
    .sort((a, b) => {
      // Sort by severity (highest first), then by date
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  function getMatterTitle(matterId: string) {
    const matter = mockMatters.find(m => m.id === matterId);
    return matter?.title || 'Unknown Matter';
  }

  function getMatter(matterId: string) {
    return mockMatters.find(m => m.id === matterId);
  }

  function getEntityName(entityCaseId: string) {
    const entity = mockEntityCases.find(e => e.id === entityCaseId);
    return entity?.entityName || 'Unknown Entity';
  }

  function getEntityType(entityCaseId: string) {
    const entity = mockEntityCases.find(e => e.id === entityCaseId);
    return entity?.entityType;
  }

  const getSeverityStyle = (severity: number) => {
    if (severity >= 5) return 'bg-state-litigation text-white';
    if (severity >= 4) return 'bg-state-violation text-white';
    if (severity >= 3) return 'bg-state-active text-white';
    return 'bg-secondary text-foreground';
  };

  const getSeverityBorderStyle = (severity: number) => {
    if (severity >= 5) return 'border-l-4 border-l-state-litigation';
    if (severity >= 4) return 'border-l-4 border-l-state-violation';
    if (severity >= 3) return 'border-l-4 border-l-state-active';
    return '';
  };

  const uniqueTriggers = [...new Set(mockViolations.map(v => v.trigger))];

  // Calculate willfulness summary
  const totalScore = mockViolations.reduce((sum, v) => sum + (v.severity * 10), 0);
  const litigationThreshold = 60;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-state-violation" />
            Violations
          </h1>
          <p className="text-muted-foreground mt-1">
            Track statutory violations and willfulness scoring
          </p>
        </div>
      </div>

      {/* Willfulness Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Violations</p>
                <p className="text-3xl font-bold">{mockViolations.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-state-violation/10">
                <AlertTriangle className="h-5 w-5 text-state-violation" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accumulated Score</p>
                <p className="text-3xl font-bold">{totalScore}</p>
              </div>
              <div className="p-3 rounded-lg bg-state-active/10">
                <Scale className="h-5 w-5 text-state-active" />
              </div>
            </div>
            <div className="mt-2">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    totalScore >= litigationThreshold ? "bg-state-litigation" : "bg-state-active"
                  )}
                  style={{ width: `${Math.min((totalScore / litigationThreshold) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {litigationThreshold - totalScore > 0 
                  ? `${litigationThreshold - totalScore} points to litigation threshold`
                  : 'Litigation threshold reached'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "card-elevated",
          totalScore >= litigationThreshold && "border-l-4 border-l-state-litigation"
        )}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Litigation Status</p>
                <p className={cn(
                  "text-lg font-semibold",
                  totalScore >= litigationThreshold ? "text-state-litigation" : "text-muted-foreground"
                )}>
                  {totalScore >= litigationThreshold ? 'Ready' : 'Not Ready'}
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-lg",
                totalScore >= litigationThreshold ? "bg-state-litigation/10" : "bg-secondary"
              )}>
                <Gavel className={cn(
                  "h-5 w-5",
                  totalScore >= litigationThreshold ? "text-state-litigation" : "text-muted-foreground"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search violations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="5">Severity 5</SelectItem>
            <SelectItem value="4">Severity 4</SelectItem>
            <SelectItem value="3">Severity 3</SelectItem>
            <SelectItem value="2">Severity 2</SelectItem>
            <SelectItem value="1">Severity 1</SelectItem>
          </SelectContent>
        </Select>
        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Trigger Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Triggers</SelectItem>
            {uniqueTriggers.map(trigger => (
              <SelectItem key={trigger} value={trigger}>
                {triggerLabels[trigger].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Violations List */}
      <div className="space-y-4">
        {filteredViolations.map(violation => {
          const matter = getMatter(violation.matterId);
          const entityType = getEntityType(violation.entityCaseId);
          
          return (
            <Card 
              key={violation.id} 
              className={cn("card-elevated", getSeverityBorderStyle(violation.severity))}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-2.5 rounded-lg flex-shrink-0",
                    violation.severity >= 4 ? "bg-state-violation/10" : "bg-state-active/10"
                  )}>
                    <AlertTriangle className={cn(
                      "h-5 w-5",
                      violation.severity >= 4 ? "text-state-violation" : "text-state-active"
                    )} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold">{triggerLabels[violation.trigger].label}</p>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold",
                        getSeverityStyle(violation.severity)
                      )}>
                        S{violation.severity}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {violation.statutorySection}
                      </span>
                      {violation.evidenceAttached && (
                        <span className="flex items-center gap-1 text-xs text-state-resolved">
                          <FileCheck className="h-3.5 w-3.5" />
                          Evidence attached
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {triggerLabels[violation.trigger].description}
                    </p>

                    <div className="flex items-center gap-4 flex-wrap">
                      {entityType && <EntityBadge type={entityType} size="sm" />}
                      <span className="text-sm text-muted-foreground">
                        {getEntityName(violation.entityCaseId)}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {getMatterTitle(violation.matterId)}
                      </span>
                      {matter && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <StateBadge state={matter.primaryState} size="sm" />
                        </>
                      )}
                    </div>

                    {violation.notes && (
                      <p className="text-sm text-muted-foreground mt-3 italic border-l-2 border-accent/30 pl-3">
                        {violation.notes}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground mt-3">
                      Logged on {format(violation.createdAt, 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredViolations.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No violations found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
