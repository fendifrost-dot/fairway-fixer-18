import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useClients } from '@/hooks/useClients';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { Users, Search, Plus, Mail, Phone, MoreVertical, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Clients() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [addClientOpen, setAddClientOpen] = useState(false);
  const { data: clients, isLoading, refetch } = useClients();

  const filteredClients = clients?.filter(client =>
    client.legal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()))
  ) ?? [];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-state-resolved/15 text-state-resolved';
      case 'Pending':
        return 'bg-state-active/15 text-state-active';
      case 'Inactive':
        return 'bg-secondary text-muted-foreground';
      default:
        return 'bg-secondary text-foreground';
    }
  };

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-accent/10 p-6 mb-6">
        <Users className="h-12 w-12 text-accent" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No clients yet</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Add your first client to activate the workflow engine.
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

  // Empty state - no clients at all
  if (!clients || clients.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-8 w-8 text-accent" />
              Clients
            </h1>
            <p className="text-muted-foreground mt-1">
              Credit file operator console
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
            <Users className="h-8 w-8 text-accent" />
            Clients
          </h1>
          <p className="text-muted-foreground mt-1">
            Credit file operator console
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <Card key={client.id} className="card-interactive group">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle 
                    className="text-lg font-semibold truncate group-hover:text-accent transition-colors cursor-pointer"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    {client.preferred_name || client.legal_name}
                  </CardTitle>
                  {client.preferred_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {client.legal_name}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}>
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem>Edit Client</DropdownMenuItem>
                    <DropdownMenuItem>Add Note</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  getStatusStyle(client.status)
                )}>
                  {client.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  Since {format(new Date(client.created_at), 'MMM yyyy')}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{client.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t flex items-center justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-accent hover:text-accent/80 h-7"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  View Details
                </Button>
              </div>

              {client.notes && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-accent/30 pl-2 mt-2">
                  {client.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No search results */}
      {filteredClients.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No clients found matching your search.</p>
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
