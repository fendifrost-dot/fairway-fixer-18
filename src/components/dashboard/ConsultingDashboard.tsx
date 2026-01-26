import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Users, Clock, CheckCircle } from 'lucide-react';

export function ConsultingDashboard() {
  // Placeholder for consulting module - will be expanded in v2
  const mockEngagements = [
    {
      id: 'eng-001',
      clientName: 'Williams Family',
      engagementType: 'Business Structuring',
      status: 'InProgress',
      targetDate: new Date('2025-02-15'),
      phase: 'Discovery',
    },
    {
      id: 'eng-002',
      clientName: 'Marcus Thompson',
      engagementType: 'Tax Preparation',
      status: 'WaitingOnClient',
      targetDate: new Date('2025-04-15'),
      phase: 'Document Collection',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-accent/10">
              <Briefcase className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">2</p>
              <p className="text-sm text-muted-foreground">Active Engagements</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-[hsl(var(--state-active))]/10">
              <Clock className="h-5 w-5 text-[hsl(var(--state-active))]" />
            </div>
            <div>
              <p className="text-2xl font-bold">1</p>
              <p className="text-sm text-muted-foreground">Waiting on Client</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-secondary">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">5</p>
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-[hsl(var(--state-resolved))]/10">
              <CheckCircle className="h-5 w-5 text-[hsl(var(--state-resolved))]" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Completed This Month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagements List */}
      <Card className="card-elevated">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            Active Engagements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockEngagements.map((engagement) => (
              <div
                key={engagement.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <p className="font-medium">{engagement.clientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {engagement.engagementType} • {engagement.phase}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    engagement.status === 'WaitingOnClient' 
                      ? 'bg-[hsl(var(--state-active))]/15 text-[hsl(var(--state-active))]'
                      : 'bg-accent/15 text-accent'
                  }`}>
                    {engagement.status === 'WaitingOnClient' ? 'Waiting on Client' : 'In Progress'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Due {engagement.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 rounded-lg bg-secondary/50 text-center">
            <p className="text-sm text-muted-foreground">
              Full consulting module coming in v2 — engagement tracking, task management, and deliverables.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
