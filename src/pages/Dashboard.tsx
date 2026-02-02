import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { useClients } from '@/hooks/useClients';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Users, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { format, parseISO, isToday, isPast } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const [addClientOpen, setAddClientOpen] = useState(false);
  
  const { data: clients, isLoading: clientsLoading, refetch: refetchClients } = useClients();
  
  // Get recent tasks across all clients
  const { data: recentTasks = [] } = useQuery({
    queryKey: ['recent-operator-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_tasks')
        .select('*, client:clients(legal_name, preferred_name)')
        .eq('status', 'Open')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });
  
  // Get recent timeline events across all clients
  const { data: recentEvents = [] } = useQuery({
    queryKey: ['recent-timeline-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*, client:clients(legal_name, preferred_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
  });

  const hasNoClients = !clientsLoading && (!clients || clients.length === 0);

  // Empty state component
  const EmptyDashboard = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-accent/10 p-6 mb-6">
        <Users className="h-12 w-12 text-accent" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No clients yet</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Add your first client to start tracking their credit file.
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
  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Empty state - no clients at all
  if (hasNoClients) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Credit File Operator Console</h1>
            <p className="text-muted-foreground mt-1">Track and manage client credit files</p>
          </div>
        </div>

        <EmptyDashboard />

        <AddClientDialog 
          open={addClientOpen} 
          onOpenChange={setAddClientOpen}
          onSuccess={() => refetchClients()}
        />
      </div>
    );
  }

  const getDueDateStyle = (dueDate: string | null) => {
    if (!dueDate) return 'text-muted-foreground';
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return 'text-red-600 font-medium';
    if (isToday(date)) return 'text-amber-600 font-medium';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit File Operator Console</h1>
          <p className="text-muted-foreground mt-1">Track and manage client credit files</p>
        </div>
        <Button onClick={() => setAddClientOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Client
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/clients')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentTasks.length}</p>
                <p className="text-sm text-muted-foreground">Open Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentEvents.length}</p>
                <p className="text-sm text-muted-foreground">Recent Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Open Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Open Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No open tasks. Great work!
              </p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task: any) => (
                  <div 
                    key={task.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clients/${task.client_id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.client?.preferred_name || task.client?.legal_name || 'Unknown Client'}
                      </p>
                    </div>
                    {task.due_date && (
                      <span className={`text-xs ${getDueDateStyle(task.due_date)}`}>
                        {format(parseISO(task.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity. Import some updates!
              </p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event: any) => (
                  <div 
                    key={event.id} 
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clients/${event.client_id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.client?.preferred_name || event.client?.legal_name || 'Unknown Client'} • {event.category}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {event.event_date ? format(parseISO(event.event_date), 'MMM d') : 'Date unknown'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <AddClientDialog 
        open={addClientOpen} 
        onOpenChange={setAddClientOpen}
        onSuccess={() => refetchClients()}
      />
    </div>
  );
}
