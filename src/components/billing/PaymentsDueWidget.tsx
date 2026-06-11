import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { format, parseISO, isPast, isToday, addDays, isBefore } from 'date-fns';

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function PaymentsDueWidget() {
  const navigate = useNavigate();
  const today = new Date();
  const weekEnd = addDays(today, 7);

  const { data: payments = [] } = useQuery({
    queryKey: ['dashboard-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, client_id, due_date, amount_due, status, client:clients(legal_name, preferred_name)')
        .neq('status', 'paid')
        .order('due_date', { ascending: true })
        .limit(50);
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data ?? [];
    },
  });

  const overdue = payments.filter((p) => {
    if (!p.due_date) return false;
    const d = parseISO(p.due_date);
    return isPast(d) && !isToday(d);
  });

  const dueThisWeek = payments.filter((p) => {
    if (!p.due_date) return false;
    const d = parseISO(p.due_date);
    return !isBefore(d, today) && isBefore(d, weekEnd);
  });

  if (payments.length === 0) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payments Due This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dueThisWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">None due this week</p>
          ) : (
            <div className="space-y-2">
              {dueThisWeek.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between p-2 rounded border text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/clients/${p.client_id}`)}
                >
                  <span>{(p.client as { preferred_name?: string; legal_name?: string })?.preferred_name || (p.client as { legal_name?: string })?.legal_name}</span>
                  <span className="tabular-nums">{formatMoney(Number(p.amount_due))} · {p.due_date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <DollarSign className="h-4 w-4" />
            Overdue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No overdue payments</p>
          ) : (
            <div className="space-y-2">
              {overdue.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between p-2 rounded border border-destructive/30 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/clients/${p.client_id}`)}
                >
                  <span>{(p.client as { preferred_name?: string; legal_name?: string })?.preferred_name || (p.client as { legal_name?: string })?.legal_name}</span>
                  <span className="tabular-nums text-destructive">{formatMoney(Number(p.amount_due))} · {p.due_date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
