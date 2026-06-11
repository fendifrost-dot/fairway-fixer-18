import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { futureDateBounds } from '@/lib/dateBounds';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Plus, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BillingPanelProps {
  clientId: string;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function BillingPanel({ clientId }: BillingPanelProps) {
  const queryClient = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Zelle');

  const { data: plan } = useQuery({
    queryKey: ['payment-plan', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_plans')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', clientId, plan?.id],
    queryFn: async () => {
      if (!plan?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('plan_id', plan.id)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!plan?.id,
  });

  const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  const total = Number(plan?.total_amount) || 0;
  const balance = Math.max(0, total - paidTotal);
  const nextPayment = payments.find((p) => p.status !== 'paid');

  const handleSetupPlan = async () => {
    const amount = parseFloat(totalAmount);
    if (!amount || amount <= 0) return;
    try {
      const { data: newPlan, error: planErr } = await supabase
        .from('payment_plans')
        .insert({
          client_id: clientId,
          plan_type: 'paid_in_full',
          total_amount: amount,
          start_date: dueDate,
          status: 'active',
        })
        .select()
        .single();
      if (planErr) throw planErr;

      await supabase.from('payments').insert({
        plan_id: newPlan.id,
        client_id: clientId,
        due_date: dueDate,
        amount_due: amount,
        status: 'scheduled',
      });

      toast.success('Payment plan created');
      setSetupOpen(false);
      queryClient.invalidateQueries({ queryKey: ['payment-plan', clientId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create plan');
    }
  };

  const handleRecordPayment = async () => {
    if (!nextPayment) return;
    const amount = parseFloat(payAmount) || Number(nextPayment.amount_due);
    try {
      await supabase
        .from('payments')
        .update({
          amount_paid: amount,
          paid_date: new Date().toISOString().slice(0, 10),
          method: payMethod,
          status: 'paid',
        })
        .eq('id', nextPayment.id);

      const newBalance = balance - amount;
      if (newBalance <= 0) {
        await supabase
          .from('payment_plans')
          .update({ status: 'completed' })
          .eq('id', plan!.id);
      }

      toast.success('Payment recorded');
      setRecordOpen(false);
      queryClient.invalidateQueries({ queryKey: ['payment-plan', clientId] });
      queryClient.invalidateQueries({ queryKey: ['payments', clientId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Billing
        </CardTitle>
        <div className="flex gap-2">
          {!plan && (
            <Button size="sm" variant="outline" onClick={() => setSetupOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Set up plan
            </Button>
          )}
          {plan && balance > 0 && (
            <Button size="sm" onClick={() => setRecordOpen(true)}>
              <CheckCircle className="h-3 w-3 mr-1" /> Record payment
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!plan ? (
          <p className="text-muted-foreground">No payment plan on file.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total agreed</p>
                <p className="font-semibold tabular-nums">{formatMoney(total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid to date</p>
                <p className="font-semibold tabular-nums">{formatMoney(paidTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance remaining</p>
                <p className="font-semibold tabular-nums text-destructive">{formatMoney(balance)}</p>
              </div>
              {nextPayment && (
                <div>
                  <p className="text-xs text-muted-foreground">Next payment</p>
                  <p className="font-medium">
                    {formatMoney(Number(nextPayment.amount_due))} due {nextPayment.due_date}
                  </p>
                </div>
              )}
            </div>
            {payments.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Due</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.due_date}</td>
                        <td className="p-2 tabular-nums">{formatMoney(Number(p.amount_due))}</td>
                        <td className="p-2">
                          <Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>{p.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Up Payment Plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Total amount</Label>
              <Input type="number" placeholder="175" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" {...futureDateBounds()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSetupPlan}>Create plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder={String(nextPayment?.amount_due ?? '')}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Zelle">Zelle</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRecordPayment}>Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function BalanceBadge({ clientId }: { clientId: string }) {
  const { data: plan } = useQuery({
    queryKey: ['payment-plan', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_plans')
        .select('total_amount, id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
  });

  const { data: paid = 0 } = useQuery({
    queryKey: ['payments-total', plan?.id],
    queryFn: async () => {
      if (!plan?.id) return 0;
      const { data } = await supabase.from('payments').select('amount_paid').eq('plan_id', plan.id);
      return (data ?? []).reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);
    },
    enabled: !!plan?.id,
  });

  if (!plan) return null;
  const balance = Math.max(0, Number(plan.total_amount) - paid);
  if (balance <= 0) return null;

  return (
    <Badge variant="outline" className="tabular-nums">
      Balance: {formatMoney(balance)}
    </Badge>
  );
}
