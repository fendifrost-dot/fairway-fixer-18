import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { mockClients, mockMatters } from '@/data/mockData';
import { Users, Search, Plus, Mail, Phone, MoreVertical, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = mockClients.filter(client =>
    client.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getClientMatterCount = (clientId: string) => {
    return mockMatters.filter(m => m.clientId === clientId).length;
  };

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
            Manage client information and associated matters
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
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
                  <CardTitle className="text-lg font-semibold truncate group-hover:text-accent transition-colors">
                    {client.preferredName || client.legalName}
                  </CardTitle>
                  {client.preferredName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {client.legalName}
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
                    <DropdownMenuItem>Edit Client</DropdownMenuItem>
                    <DropdownMenuItem>View Matters</DropdownMenuItem>
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
                  Since {format(client.createdAt, 'MMM yyyy')}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{client.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                  <span>{getClientMatterCount(client.id)} matter{getClientMatterCount(client.id) !== 1 ? 's' : ''}</span>
                </div>
                <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80 h-7">
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

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No clients found matching your search.</p>
        </div>
      )}
    </div>
  );
}
