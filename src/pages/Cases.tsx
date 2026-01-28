import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { useCasesWithClients } from '@/hooks/useCases';
import { 
  FolderOpen, 
  Search, 
  Plus, 
  Calendar, 
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

export default function Cases() {
  const [searchQuery, setSearchQuery] = useState('');
  const [addClientOpen, setAddClientOpen] = useState(false);
  
  const { data: cases, isLoading, refetch } = useCasesWithClients();

  const filteredCases = cases?.filter(caseItem => {
    const clientName = caseItem.client?.preferred_name || caseItem.client?.legal_name || '';
    const matchesSearch = 
      caseItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) ?? [];

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-accent/10 p-6 mb-6">
        <FolderOpen className="h-12 w-12 text-accent" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No cases yet</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Add your first client to create a case.
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
  if (!cases || cases.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-accent" />
              Cases
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
            Cases
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
          New Case
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {filteredCases.map((caseItem) => {
          const clientName = caseItem.client?.preferred_name || caseItem.client?.legal_name || 'Unknown';
          
          return (
            <Link key={caseItem.id} to={`/cases/${caseItem.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold truncate">
                          {clientName}
                        </h3>
                        <Badge variant={caseItem.client?.status === 'Active' ? 'default' : 'secondary'}>
                          {caseItem.client?.status || 'Active'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-xs font-mono">{caseItem.id.slice(0, 8)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Opened {format(new Date(caseItem.opened_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Updated {format(new Date(caseItem.updated_at), 'MMM d')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {filteredCases.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No cases found matching your search.</p>
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
