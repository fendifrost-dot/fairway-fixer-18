import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react';

const BUREAUS = ['Equifax', 'Experian', 'TransUnion'] as const;

interface TimelineEvent {
  id: string;
  event_date: string;
  category: string;
  source: string;
  summary: string;
  title: string;
}

interface BureauResponse {
  id: string;
  bureau: string;
  response_date: string;
  response_type: string | null;
  follow_up_action: string | null;
  violations_detected: any[] | null;
  violation_count: number | null;
}

interface ClientAccount {
  id: string;
  bureau: string | null;
  creditor_name: string;
  account_number: string | null;
  account_type: string | null;
  payment_status: string | null;
  balance: number | null;
  dispute_status: string | null;
}

function NarrativeEntry({ date, icon, title, content, variant = 'default' }: {
  date: string;
  icon: React.ReactNode;
  title: string;
  content: string;
  variant?: 'default' | 'violation' | 'success';
}) {
  const borderColor = variant === 'violation' ? 'border-l-red-500' : variant === 'success' ? 'border-l-green-500' : 'border-l-blue-500';
  return (
    <div className={`border-l-2 ${borderColor} pl-4 py-2`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        <time>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{content}</p>
    </div>
  );
}

function BureauTab({ bureau, events, responses, accounts }: {
  bureau: string;
  events: TimelineEvent[];
  responses: BureauResponse[];
  accounts: ClientAccount[];
}) {
  // Build a unified timeline sorted by date
  type NarrativeItem = { date: string; type: 'event' | 'response' | 'account'; data: any };
  const items: NarrativeItem[] = [
    ...events.map(e => ({ date: e.event_date, type: 'event' as const, data: e })),
    ...responses.map(r => ({ date: r.response_date, type: 'response' as const, data: r })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const disputedAccounts = accounts.filter(a => a.dispute_status && a.dispute_status !== 'none');
  const violationCount = responses.reduce((sum, r) => sum + (r.violation_count || 0), 0);

  return (
    <div className="space-y-4">
      {/* Bureau Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded border">
          <p className="text-lg font-bold">{events.length}</p>
          <p className="text-xs text-muted-foreground">Events</p>
        </div>
        <div className="text-center p-2 rounded border">
          <p className="text-lg font-bold text-red-500">{violationCount}</p>
          <p className="text-xs text-muted-foreground">Violations</p>
        </div>
        <div className="text-center p-2 rounded border">
          <p className="text-lg font-bold">{disputedAccounts.length}</p>
          <p className="text-xs text-muted-foreground">Disputed</p>
        </div>
      </div>

      {/* Disputed Accounts */}
      {disputedAccounts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase">Disputed Accounts</p>
          {disputedAccounts.map(a => (
            <div key={a.id} className="flex items-center justify-between text-xs p-2 rounded border">
              <span className="font-medium">{a.creditor_name}</span>
              <div className="flex items-center gap-2">
                {a.balance !== null && <span className="text-muted-foreground">${a.balance.toLocaleString()}</span>}
                <Badge variant={a.dispute_status === 'resolved' ? 'default' : 'destructive'} className="text-xs">
                  {a.dispute_status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline Narrative */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No activity recorded for {bureau} yet.</p>
          )}
          {items.map((item, i) => {
            if (item.type === 'response') {
              const r = item.data as BureauResponse;
              const hasViolations = r.violation_count > 0;
              return (
                <NarrativeEntry
                  key={`resp-${r.id}`}
                  date={r.response_date}
                  icon={hasViolations ? <AlertTriangle className="h-3 w-3 text-red-500" /> : <CheckCircle className="h-3 w-3 text-green-500" />}
                  title={`${r.response_type} Response${hasViolations ? ` — ${r.violation_count} violation(s)` : ''}`}
                  content={r.summary || 'No summary available'}
                  variant={hasViolations ? 'violation' : 'success'}
                />
              );
            }
            const e = item.data as TimelineEvent;
            return (
              <NarrativeEntry
                key={`evt-${e.id}`}
                date={e.event_date}
                icon={<FileText className="h-3 w-3" />}
                title={e.title || e.category}
                content={e.summary}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function BureauNarrative({ clientId }: { clientId: string }) {
  const [activeBureau, setActiveBureau] = useState<string>('Equifax');

  const { data: events = [] } = useQuery({
    queryKey: ['timeline_events', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('timeline_events').select('*').eq('client_id', clientId).order('event_date', { ascending: false });
      return (data ?? []) as TimelineEvent[];
    },
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['bureau_responses', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('bureau_responses').select('*').eq('client_id', clientId).order('response_date', { ascending: false });
      return (data ?? []) as BureauResponse[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['client_accounts', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('client_accounts').select('*').eq('client_id', clientId);
      return (data ?? []) as ClientAccount[];
    },
  });

  const filterByBureau = <T extends { bureau?: string; source?: string }>(items: T[], bureau: string) =>
    items.filter(item => (item.bureau || item.source || '').toLowerCase().includes(bureau.toLowerCase()));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <CardTitle className="text-sm font-medium">Bureau Narrative</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeBureau} onValueChange={setActiveBureau}>
          <TabsList className="grid w-full grid-cols-3">
            {BUREAUS.map(b => (
              <TabsTrigger key={b} value={b} className="text-xs">{b}</TabsTrigger>
            ))}
          </TabsList>
          {BUREAUS.map(b => (
            <TabsContent key={b} value={b}>
              <BureauTab
                bureau={b}
                events={filterByBureau(events, b)}
                responses={filterByBureau(responses, b)}
                accounts={filterByBureau(accounts, b)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
