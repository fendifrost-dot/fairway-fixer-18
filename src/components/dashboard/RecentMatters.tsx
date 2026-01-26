import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StateBadge, OverlayBadge } from '@/components/ui/StatusBadge';
import { mockMatters, mockClients } from '@/data/mockData';
import { ArrowRight, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';

export function RecentMatters() {
  const recentMatters = mockMatters
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .slice(0, 5);

  const getClientName = (clientId: string) => {
    const client = mockClients.find(c => c.id === clientId);
    return client?.preferredName || client?.legalName || 'Unknown';
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          Recent Matters
        </CardTitle>
        <Link 
          to="/matters" 
          className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 font-medium"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {recentMatters.map((matter) => (
            <Link
              key={matter.id}
              to={`/matters/${matter.id}`}
              className="block p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate group-hover:text-accent transition-colors">
                      {matter.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getClientName(matter.clientId)}</span>
                    <span>•</span>
                    <span>{format(matter.openedAt, 'MMM d, yyyy')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {matter.overlays.filter(o => o.isActive).map((overlay) => (
                    <OverlayBadge key={overlay.id} overlay={overlay.overlayType} size="sm" />
                  ))}
                  <StateBadge state={matter.primaryState} size="sm" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
