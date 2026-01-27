import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StateBadge, EntityBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import { InitializeCaseStructure } from '@/components/matters/InitializeCaseStructure';
import { DbMatter, DbEntityCase, DbTask, DbDeadline, DbViolation, DbAction, DbResponse, DbOverlay, DEADLINE_LABELS } from '@/types/database';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ArrowLeft, FileText, Clock, AlertTriangle, Scale, Loader2, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MatterDetail() {
  const { matterId } = useParams<{ matterId: string }>();

  const { data: matter, isLoading: matterLoading } = useQuery({
    queryKey: ['matter', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matters')
        .select('*, client:clients(*)')
        .eq('id', matterId)
        .maybeSingle();
      
      if (error) throw error;
      return data as DbMatter | null;
    },
    enabled: !!matterId,
  });

  const { data: entityCases = [] } = useQuery({
    queryKey: ['matterEntityCases', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_cases')
        .select('*')
        .eq('matter_id', matterId)
        .order('entity_type');
      
      if (error) throw error;
      return data as DbEntityCase[];
    },
    enabled: !!matterId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['matterTasks', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, entity_case:entity_cases(*)')
        .eq('matter_id', matterId)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data as DbTask[];
    },
    enabled: !!matterId,
  });

  const { data: deadlines = [] } = useQuery({
    queryKey: ['matterDeadlines', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadlines')
        .select('*, entity_case:entity_cases(*)')
        .eq('matter_id', matterId)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data as DbDeadline[];
    },
    enabled: !!matterId,
  });

  const { data: violations = [] } = useQuery({
    queryKey: ['matterViolations', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('violations')
        .select('*, entity_case:entity_cases(*)')
        .eq('matter_id', matterId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DbViolation[];
    },
    enabled: !!matterId,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['matterActions', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actions')
        .select('*, entity_case:entity_cases(*)')
        .eq('matter_id', matterId)
        .order('action_date', { ascending: false });
      
      if (error) throw error;
      return data as DbAction[];
    },
    enabled: !!matterId,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['matterResponses', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('responses')
        .select('*, entity_case:entity_cases(*)')
        .eq('matter_id', matterId)
        .order('received_date', { ascending: false });
      
      if (error) throw error;
      return data as DbResponse[];
    },
    enabled: !!matterId,
  });

  const { data: overlays = [] } = useQuery({
    queryKey: ['matterOverlays', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('overlays')
        .select('*')
        .eq('matter_id', matterId);
      
      if (error) throw error;
      return data as DbOverlay[];
    },
    enabled: !!matterId,
  });

  if (matterLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Matter not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/matters">Back to Matters</Link>
        </Button>
      </div>
    );
  }

  const formatDaysRemaining = (dueDate: string) => {
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return `D+${Math.abs(days)}`;
    if (days === 0) return 'Today';
    return `D-${days}`;
  };

  const getDaysStyle = (dueDate: string) => {
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return 'text-[hsl(var(--state-violation))] font-bold';
    if (days <= 3) return 'text-[hsl(var(--state-active))] font-semibold';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/matters">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      {/* Matter Info Card */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StateBadge state={matter.primary_state} />
              <Badge variant="outline">{matter.matter_type}</Badge>
            </div>
            <CardTitle className="text-2xl">{matter.title}</CardTitle>
            <Link 
              to={`/clients/${matter.client_id}`}
              className="text-muted-foreground hover:text-accent transition-colors flex items-center gap-1 mt-1"
            >
              <User className="h-4 w-4" />
              {matter.client?.preferred_name || matter.client?.legal_name}
            </Link>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4" />
              Opened {format(parseISO(matter.opened_at), 'MMM d, yyyy')}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Entity Cases</span>
              <p className="text-lg font-semibold">{entityCases.length}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Open Tasks</span>
              <p className="text-lg font-semibold">{tasks.filter(t => t.status !== 'Done').length}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Active Deadlines</span>
              <p className="text-lg font-semibold">{deadlines.filter(d => d.status !== 'Closed').length}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Violations</span>
              <p className="text-lg font-semibold text-[hsl(var(--state-violation))]">{violations.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Initialize Case Structure (post-intake) */}
      <InitializeCaseStructure
        matterId={matterId!}
        existingEntityNames={entityCases.map(e => e.entity_name)}
        existingOverlayTypes={overlays.map(o => o.overlay_type)}
      />

      {/* Entity Cases */}
      {entityCases.length > 0 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Entity Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {entityCases.map(entity => (
                <Link
                  key={entity.id}
                  to={`/matters/${matterId}/entities/${entity.id}`}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <EntityBadge type={entity.entity_type} />
                    <StateBadge state={entity.state} size="sm" />
                  </div>
                  <p className="font-medium">{entity.entity_name}</p>
                  {entity.last_action_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last action: {format(parseISO(entity.last_action_at), 'MMM d')}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Tasks, Deadlines, Actions, Responses, Violations */}
      <Tabs defaultValue="tasks">
        <TabsList className="bg-secondary">
          <TabsTrigger value="tasks">Tasks ({tasks.filter(t => t.status !== 'Done').length})</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines ({deadlines.filter(d => d.status !== 'Closed').length})</TabsTrigger>
          <TabsTrigger value="actions">Actions ({actions.length})</TabsTrigger>
          <TabsTrigger value="responses">Responses ({responses.length})</TabsTrigger>
          <TabsTrigger value="violations">Violations ({violations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardContent className="pt-6">
              {tasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tasks</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Priority</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map(task => (
                      <TableRow key={task.id}>
                        <TableCell><PriorityBadge priority={task.priority} size="sm" /></TableCell>
                        <TableCell className="font-medium">{task.task_type}</TableCell>
                        <TableCell>{task.entity_case?.entity_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={task.status === 'Done' ? 'secondary' : 'outline'}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right", task.due_date && getDaysStyle(task.due_date))}>
                          {task.due_date ? formatDaysRemaining(task.due_date) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadlines">
          <Card>
            <CardContent className="pt-6">
              {deadlines.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No deadlines</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadlines.map(deadline => (
                      <TableRow key={deadline.id}>
                        <TableCell className="font-medium">
                          {DEADLINE_LABELS[deadline.deadline_type]?.label || deadline.deadline_type}
                        </TableCell>
                        <TableCell>{deadline.entity_case?.entity_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={deadline.status === 'Closed' ? 'secondary' : 'outline'}>
                            {deadline.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(parseISO(deadline.start_date), 'MMM d')}</TableCell>
                        <TableCell className={cn("text-right", getDaysStyle(deadline.due_date))}>
                          {formatDaysRemaining(deadline.due_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardContent className="pt-6">
              {actions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No actions logged</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.map(action => (
                      <TableRow key={action.id}>
                        <TableCell>{format(parseISO(action.action_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{action.action_type}</TableCell>
                        <TableCell>{(action as any).entity_case?.entity_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[200px]">
                          {action.summary || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses">
          <Card>
            <CardContent className="pt-6">
              {responses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No responses logged</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map(response => (
                      <TableRow key={response.id}>
                        <TableCell>{format(parseISO(response.received_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{response.response_type}</TableCell>
                        <TableCell>{(response as any).entity_case?.entity_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[200px]">
                          {response.summary || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations">
          <Card>
            <CardContent className="pt-6">
              {violations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No violations recorded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Statute</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="text-right">Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {violations.map(violation => (
                      <TableRow key={violation.id}>
                        <TableCell>{format(parseISO(violation.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{violation.trigger}</TableCell>
                        <TableCell className="font-mono text-sm">{violation.statutory_section}</TableCell>
                        <TableCell>{violation.entity_case?.entity_name || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            className={cn(
                              violation.severity >= 4 
                                ? "bg-[hsl(var(--state-violation))] text-white" 
                                : "bg-[hsl(var(--state-active))] text-white"
                            )}
                          >
                            S{violation.severity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
