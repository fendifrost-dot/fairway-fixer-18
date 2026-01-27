import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StateBadge, OverlayBadge, EntityBadge } from '@/components/ui/StatusBadge';
import { useMattersWithRelations } from '@/hooks/useMatters';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { 
  FolderOpen, 
  Search, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  Building2,
  Filter,
  Loader2
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatterState } from '@/types/database';

export default function Matters() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [addClientOpen, setAddClientOpen] = useState(false);
  
  const { data: matters, isLoading, refetch } = useMattersWithRelations();

  const filteredMatters = matters?.filter(matter => {
    const matchesSearch = matter.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === 'all' || matter.primary_state === stateFilter;
    return matchesSearch && matchesState;
  }) ?? [];

  const uniqueStates = [...new Set(matters?.map(m => m.primary_state) ?? [])];

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-accent/10 p-6 mb-6">
        <FolderOpen className="h-12 w-12 text-accent" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No matters yet</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Add your first client to create matters and activate the workflow engine.
      </p>
      <Button 
        onClick={() => setAddClientOpen(true)}
        className="bg-accent hover:bg-accent/90 text-accent-foreground"
        size="lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        Add Client
      </Button>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Empty state
  if (!matters || matters.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-accent" />
              Matters
            </h1>
            <p className="text-muted-foreground mt-1">
              Credit repair and consulting cases
            </p>
          </div>
        </div>
        <EmptyState />
        <AddClientDialog 
          open={addClientOpen} 
          onOpenChange={setAddClientOpen}
          onSuccess={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-accent" />
            Matters
          </h1>
          <p className="text-muted-foreground mt-1">
            Credit repair and consulting cases
          </p>
        </div>
        <Button 
          onClick={() => setAddClientOpen(true)}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search matters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {uniqueStates.map(state => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Matters List */}
      <div className="space-y-4">
        {filteredMatters.map((matter) => {
          const entityCases = matter.entity_cases ?? [];
          const violations = matter.violations ?? [];
          const activeDeadlines = matter.deadlines?.filter(d => d.status !== 'Closed') ?? [];
          const nextDeadline = activeDeadlines.sort((a, b) => 
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          )[0];
          const daysUntilDeadline = nextDeadline 
            ? differenceInDays(new Date(nextDeadline.due_date), new Date()) 
            : null;
          const activeOverlays = matter.overlays?.filter(o => o.is_active) ?? [];

          return (
            <Link key={matter.id} to={`/matters/${matter.id}`}>
              <Card className="card-interactive">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side */}
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-lg truncate group-hover:text-accent transition-colors">
                            {matter.title}
                          </h3>
                          <StateBadge state={matter.primary_state as MatterState} />
                          {activeOverlays.map((overlay) => (
                            <OverlayBadge key={overlay.id} overlay={overlay.overlay_type as any} size="sm" />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{matter.client?.preferred_name || matter.client?.legal_name || 'Unknown'}</span>
                          {matter.jurisdiction && (
                            <>
                              <span>•</span>
                              <span>{matter.jurisdiction}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Opened {format(new Date(matter.opened_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>

                      {/* Entity cases */}
                      {entityCases.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {entityCases.map((entity) => (
                            <div key={entity.id} className="flex items-center gap-1.5">
                              <EntityBadge type={entity.entity_type} size="sm" />
                              <span className="text-xs text-muted-foreground">{entity.entity_name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Escalation Strategy */}
                      {matter.escalation_strategy && (
                        <p className="text-xs text-muted-foreground italic">
                          Strategy: {matter.escalation_strategy}
                        </p>
                      )}
                    </div>

                    {/* Right side - stats */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {/* Violations */}
                      {violations.length > 0 && (
                        <div className="text-center">
                          <div className="flex items-center gap-1.5 text-state-violation">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-bold">{violations.length}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Violations</p>
                        </div>
                      )}

                      {/* Next deadline */}
                      {nextDeadline && (
                        <div className="text-center">
                          <div className={cn(
                            "flex items-center gap-1.5",
                            daysUntilDeadline !== null && daysUntilDeadline < 0 ? "text-state-violation" :
                            daysUntilDeadline !== null && daysUntilDeadline <= 3 ? "text-state-active" :
                            "text-muted-foreground"
                          )}>
                            <Clock className="h-4 w-4" />
                            <span className="font-bold">
                              {daysUntilDeadline !== null ? (
                                daysUntilDeadline < 0 ? `${Math.abs(daysUntilDeadline)}d late` :
                                daysUntilDeadline === 0 ? 'Today' :
                                `${daysUntilDeadline}d`
                              ) : '—'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">Next deadline</p>
                        </div>
                      )}

                      {/* Entities */}
                      <div className="text-center">
                        <span className="font-bold text-foreground">{entityCases.length}</span>
                        <p className="text-xs text-muted-foreground">Entities</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {filteredMatters.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No matters found matching your criteria.</p>
        </div>
      )}

      <AddClientDialog 
        open={addClientOpen} 
        onOpenChange={setAddClientOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
