import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DbClient } from '@/types/database';
import { ArrowLeft, Loader2, FileDown, Trash2, LayoutList, Inbox, FileText } from 'lucide-react';
import { ClientHeader } from '@/components/operator/ClientHeader';
import { EvidenceTimeline } from '@/components/operator/EvidenceTimeline/index';
import { EvidenceTimelineSkeleton } from '@/components/operator/EvidenceTimeline/EvidenceTimelineSkeleton';
import { NotesSection } from '@/components/operator/NotesSection';
import { CreditReportPanel } from '@/components/creditReport/CreditReportPanel';
import { CreditGuardianAnalyzerPanel } from '@/components/creditReport/CreditGuardianAnalyzerPanel';
import { DraftLettersPanel } from '@/components/creditReport/DraftLettersPanel';
import { WeeklyUpdateDialog } from '@/components/weeklyUpdate/WeeklyUpdateDialog';
import { BillingPanel, BalanceBadge } from '@/components/billing/BillingPanel';

import { ScheduledEvents } from '@/components/operator/ScheduledEvents/index';
import { UnresolvedStatePanel } from '@/components/operator/UnresolvedStatePanel';
import { BaselinePanel } from '@/components/baseline/BaselinePanel';
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';
import { useOperatorTasks } from '@/hooks/useOperatorTasks';
import { downloadPDF } from '@/lib/pdfExport';
import { ParseResult, UnresolvedItem } from '@/types/parser';

const InboxTabContent = lazy(() => import('@/components/operator/InboxTabContent'));

const CLIENT_TAB_VALUES = ['evidence', 'inbox'] as const;
type ClientTabValue = (typeof CLIENT_TAB_VALUES)[number];

function isClientTabValue(v: string | null): v is ClientTabValue {
  return v === 'evidence' || v === 'inbox';
}

function InboxTabFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading import tools">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [unresolvedItems, setUnresolvedItems] = useState<UnresolvedItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [weeklyUpdateOpen, setWeeklyUpdateOpen] = useState(false);

  const activeTab = useMemo((): ClientTabValue => {
    const raw = searchParams.get('tab');
    return isClientTabValue(raw) ? raw : 'evidence';
  }, [searchParams]);

  const setActiveTab = useCallback(
    (value: string) => {
      if (!isClientTabValue(value)) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === 'evidence') {
            next.delete('tab');
          } else {
            next.set('tab', value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

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

  const { data: events = [], isLoading: eventsLoading } = useTimelineEvents(clientId);
  const { data: tasks = [] } = useOperatorTasks(clientId);
  const openTasks = tasks.filter((t) => t.status === 'Open').length;

  const handleCreditReportRefresh = useCallback(() => {
    if (!clientId) return;
    queryClient.invalidateQueries({ queryKey: ['credit-reports', clientId] });
    queryClient.invalidateQueries({ queryKey: ['dispute-letters', clientId] });
  }, [clientId, queryClient]);

  const handleImportComplete = (result: ParseResult) => {
    if (result.unresolved_items.length > 0) {
      setUnresolvedItems((prev) => [...prev, ...result.unresolved_items]);
    }
  };

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

  const handleGeneratePDF = () => {
    downloadPDF(client, events, tasks);
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/clients">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Button onClick={() => setWeeklyUpdateOpen(true)} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              Generate Weekly Update
            </Button>
            <Button onClick={handleGeneratePDF} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              Generate PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Client
            </Button>
          </div>
        </div>

        <ClientHeader client={client} balanceBadge={<BalanceBadge clientId={clientId!} />} />

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-auto gap-1 p-1 sm:inline-flex sm:w-auto sm:h-10">
                <TabsTrigger value="evidence" className="gap-2 py-2.5 sm:py-1.5">
                  <LayoutList className="h-4 w-4 shrink-0" />
                  Evidence &amp; notes
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-2 py-2.5 sm:py-1.5">
                  <Inbox className="h-4 w-4 shrink-0" />
                  Import &amp; letters
                </TabsTrigger>
              </TabsList>

              <TabsContent value="evidence" className="mt-4 space-y-6 focus-visible:outline-none">
                {eventsLoading ? (
                  <EvidenceTimelineSkeleton />
                ) : (
                  <EvidenceTimeline events={events} clientId={clientId!} />
                )}
                <BaselinePanel clientId={clientId!} />
                <CreditReportPanel clientId={clientId!} onRefresh={handleCreditReportRefresh} />
                <CreditGuardianAnalyzerPanel clientId={clientId!} />
                <DraftLettersPanel clientId={clientId!} />
                <BillingPanel clientId={clientId!} />
                <NotesSection clientId={clientId!} />
              </TabsContent>

              <TabsContent value="inbox" className="mt-4 focus-visible:outline-none">
                <Suspense fallback={<InboxTabFallback />}>
                  <InboxTabContent
                    clientId={clientId!}
                    events={events}
                    onImportComplete={handleImportComplete}
                  />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This file</p>
              <p className="mt-1 text-foreground">
                {eventsLoading ? (
                  <Skeleton className="inline-block h-8 w-10 align-middle" />
                ) : (
                  <span className="text-2xl font-semibold tabular-nums">{events.length}</span>
                )}
                <span className="text-muted-foreground"> evidence events</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">{openTasks}</span> open tasks
              </p>
            </div>
            {unresolvedItems.length > 0 && (
              <UnresolvedStatePanel items={unresolvedItems} />
            )}
            <ScheduledEvents tasks={tasks} clientId={clientId!} timelineEvents={events} />
          </aside>
        </div>
      </div>

      <DeleteClientDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        clientId={clientId!}
        clientName={client.legal_name}
      />

      <WeeklyUpdateDialog
        open={weeklyUpdateOpen}
        onOpenChange={setWeeklyUpdateOpen}
        clientId={clientId!}
        clientName={client.legal_name}
      />
    </>
  );
}
