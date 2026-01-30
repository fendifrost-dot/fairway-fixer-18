import { DbClient } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { User, Mail, Phone } from 'lucide-react';

interface ClientHeaderProps {
  client: DbClient;
}

export function ClientHeader({ client }: ClientHeaderProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700 border-green-200';
      case 'Inactive': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-secondary';
    }
  };
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold">
                {client.preferred_name || client.legal_name}
              </h1>
              <Badge variant="outline" className={getStatusColor(client.status)}>
                {client.status}
              </Badge>
            </div>
            
            {client.preferred_name && (
              <p className="text-sm text-muted-foreground">{client.legal_name}</p>
            )}
            
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </span>
              )}
              <span>
                Last updated: {format(parseISO(client.updated_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
