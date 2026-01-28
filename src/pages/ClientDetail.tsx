import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StateBadge } from '@/components/ui/StatusBadge';
import { DbClient, DbMatter } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, User, Mail, Phone, FileText, Plus, Loader2 } from 'lucide-react';

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data as DbClient | null;
    },
    enabled: !!clientId,
  });

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ['clientCases', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matters')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DbMatter[];
    },
    enabled: !!clientId,
  });

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/clients">Back to Clients</Link>
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-[hsl(var(--state-resolved))] text-white';
      case 'Inactive': return 'bg-muted text-muted-foreground';
      case 'Pending': return 'bg-[hsl(var(--state-active))] text-white';
      default: return 'bg-secondary';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      {/* Client Info Card */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
              <User className="h-8 w-8 text-accent" />
            </div>
            <div>
              <CardTitle className="text-2xl">{client.preferred_name || client.legal_name}</CardTitle>
              {client.preferred_name && (
                <p className="text-muted-foreground">{client.legal_name}</p>
              )}
              <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Edit Client
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground">Created</span>
              <p className="text-sm">{format(parseISO(client.created_at), 'MMM d, yyyy')}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Cases</span>
              <p className="text-sm font-semibold">{cases.length}</p>
            </div>
          </div>
          {client.notes && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cases */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cases
          </CardTitle>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Case
          </Button>
        </CardHeader>
        <CardContent>
          {casesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cases for this client
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map(caseItem => (
                  <TableRow key={caseItem.id}>
                    <TableCell>
                      <Link 
                        to={`/cases/${caseItem.id}`}
                        className="font-medium hover:text-accent transition-colors"
                      >
                        {caseItem.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{caseItem.matter_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <StateBadge state={caseItem.primary_state} size="sm" />
                    </TableCell>
                    <TableCell>
                      {format(parseISO(caseItem.opened_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/cases/${caseItem.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
