import { useState, useEffect } from 'react';
import { useBaseline } from '@/hooks/useBaseline';
import { BaselineTargetsTable } from './BaselineTargetsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
}

export function BaselinePanel({ clientId }: Props) {
  const { activeBaseline, history } = useBaseline(clientId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select: active baseline first, else most recent from history
  useEffect(() => {
    if (selectedId) return;
    if (activeBaseline.data) {
      setSelectedId(activeBaseline.data.id);
    } else if (history.data && history.data.length > 0) {
      setSelectedId(history.data[0].id);
    }
  }, [activeBaseline.data, history.data, selectedId]);

  const isLoading = activeBaseline.isLoading || history.isLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Baseline Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const historyList = history.data ?? [];
  const selected = historyList.find((b) => b.id === selectedId) ?? activeBaseline.data;

  if (historyList.length === 0 && !activeBaseline.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Baseline Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No baseline analysis yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Baseline Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* History list */}
        {historyList.length > 1 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">History</p>
            <div className="flex flex-wrap gap-2">
              {historyList.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors',
                    b.id === selectedId
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  )}
                >
                  <FileText className="h-3 w-3" />
                  {b.source_type} — {format(new Date(b.created_at), 'MMM d, yyyy')}
                  {b.is_active && (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-primary">Active</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected baseline summary */}
        {selected && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selected.source_type}
                {selected.is_active && (
                  <span className="ml-2 text-xs text-primary font-semibold">(Active)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(selected.created_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        )}

        {/* Targets table */}
        {selectedId && <BaselineTargetsTable baselineId={selectedId} />}
      </CardContent>
    </Card>
  );
}
