import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, RotateCcw, Filter, User, Building2, Clock } from 'lucide-react';
import { useClients } from '@/hooks/useDashboardData';
import { DashboardFilters, MatterState, STATE_LABELS, PRESET_VIEWS, MatterType } from '@/types/database';
import { cn } from '@/lib/utils';

interface GlobalFilterBarProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

const ACTIVE_STATES: MatterState[] = [
  'DisputeActive',
  'PartialCompliance',
  'ViolationConfirmed',
  'ReinsertionDetected',
  'RegulatoryReview',
  'FurnisherLiabilityTrack',
  'EscalationEligible',
  'LitigationReady',
];

export function GlobalFilterBar({ filters, onFiltersChange }: GlobalFilterBarProps) {
  const { data: clients = [] } = useClients();
  const [clientOpen, setClientOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);

  const selectedClient = clients.find(c => c.id === filters.clientId);

  const handleScopeChange = (scope: 'all' | 'single' | 'assigned') => {
    onFiltersChange({
      ...filters,
      scope,
      clientId: scope === 'single' ? filters.clientId : undefined,
    });
  };

  const handleClientSelect = (clientId: string) => {
    onFiltersChange({
      ...filters,
      scope: 'single',
      clientId,
    });
    setClientOpen(false);
  };

  const handleMatterTypeChange = (matterType: string) => {
    onFiltersChange({
      ...filters,
      matterType: matterType as MatterType | 'all',
    });
  };

  const handleStateToggle = (state: MatterState) => {
    const newStates = filters.states.includes(state)
      ? filters.states.filter(s => s !== state)
      : [...filters.states, state];
    onFiltersChange({ ...filters, states: newStates });
  };

  const handleTimeWindowChange = (timeWindow: string) => {
    onFiltersChange({
      ...filters,
      timeWindow: timeWindow as DashboardFilters['timeWindow'],
    });
  };

  const handlePresetView = (presetFilters: Partial<DashboardFilters>) => {
    onFiltersChange({
      ...filters,
      ...presetFilters,
      states: presetFilters.states || ACTIVE_STATES,
    });
  };

  const handleReset = () => {
    onFiltersChange({
      scope: 'all',
      clientId: undefined,
      matterType: 'Credit',
      states: ACTIVE_STATES,
      timeWindow: 'today',
    });
  };

  const activeFilterCount = [
    filters.scope !== 'all',
    filters.matterType !== 'Credit',
    filters.timeWindow !== 'today',
    filters.states.length !== ACTIVE_STATES.length,
  ].filter(Boolean).length;

  return (
    <div className="card-elevated p-3 space-y-3">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Scope selector */}
        <div className="flex items-center gap-1">
          <User className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.scope} onValueChange={handleScopeChange}>
            <SelectTrigger className="w-[140px] h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Clients</SelectItem>
              <SelectItem value="single">Single Client</SelectItem>
              <SelectItem value="assigned">My Assigned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Client picker (when scope is single) */}
        {filters.scope === 'single' && (
          <Popover open={clientOpen} onOpenChange={setClientOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={clientOpen}
                className="w-[200px] h-8 justify-between bg-background"
              >
                {selectedClient?.legal_name || "Select client..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 bg-popover z-50">
              <Command>
                <CommandInput placeholder="Search clients..." />
                <CommandList>
                  <CommandEmpty>No client found.</CommandEmpty>
                  <CommandGroup>
                    {clients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.legal_name}
                        onSelect={() => handleClientSelect(client.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            filters.clientId === client.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {client.preferred_name || client.legal_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        <div className="h-6 w-px bg-border" />

        {/* Matter type */}
        <div className="flex items-center gap-1">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.matterType} onValueChange={handleMatterTypeChange}>
            <SelectTrigger className="w-[120px] h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="Credit">Credit</SelectItem>
              <SelectItem value="Consulting">Consulting</SelectItem>
              <SelectItem value="Both">Both</SelectItem>
              <SelectItem value="all">All Types</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Time window */}
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.timeWindow} onValueChange={handleTimeWindowChange}>
            <SelectTrigger className="w-[120px] h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Next 7 Days</SelectItem>
              <SelectItem value="month">Next 30 Days</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* State filter */}
        <Popover open={stateOpen} onOpenChange={setStateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 gap-1 bg-background">
              <Filter className="h-4 w-4" />
              States
              {filters.states.length < ACTIVE_STATES.length && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {filters.states.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2 bg-popover z-50" align="start">
            <div className="grid grid-cols-2 gap-1">
              {ACTIVE_STATES.map((state) => (
                <Button
                  key={state}
                  variant={filters.states.includes(state) ? "default" : "ghost"}
                  size="sm"
                  className="justify-start text-xs h-7"
                  onClick={() => handleStateToggle(state)}
                >
                  {STATE_LABELS[state].label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Reset button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={handleReset}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Saved views row */}
      <div className="flex items-center gap-2 border-t pt-2">
        <span className="text-xs text-muted-foreground">Quick views:</span>
        {PRESET_VIEWS.map((view) => (
          <Button
            key={view.name}
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => handlePresetView(view.filters)}
          >
            {view.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
