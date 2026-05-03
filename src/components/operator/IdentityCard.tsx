import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DbClient } from '@/types/database';

function formatDOB(dob?: string | null): string {
  if (!dob) return '—';
  try {
    return format(parseISO(dob), 'M/d/yyyy');
  } catch {
    return dob;
  }
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

function maskSSN(s?: string | null): string {
  if (!s) return '—';
  return `●●●-●●-${s}`;
}

type FieldKey = 'date_of_birth' | 'current_address' | 'ssn_last4' | 'phone' | 'email' | 'alternate_addresses';

export function IdentityCard({ client }: { client: DbClient }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [draftList, setDraftList] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = (field: FieldKey) => {
    setEditing(field);
    if (field === 'alternate_addresses') {
      setDraftList(client.alternate_addresses ?? []);
    } else {
      const v = (client as any)[field];
      setDraft(v ?? '');
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
    setDraftList([]);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      let value: any;
      if (editing === 'alternate_addresses') {
        value = draftList.map((s) => s.trim()).filter(Boolean);
      } else if (editing === 'phone') {
        value = draft.replace(/\D/g, '') || null;
      } else if (editing === 'ssn_last4') {
        const v = draft.trim();
        if (v && !/^[0-9]{4}$/.test(v)) {
          toast.error('SSN must be exactly 4 digits');
          setSaving(false);
          return;
        }
        value = v || null;
      } else if (editing === 'email') {
        const v = draft.trim().toLowerCase();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          toast.error('Invalid email');
          setSaving(false);
          return;
        }
        value = v || null;
      } else if (editing === 'date_of_birth') {
        value = draft.trim() || null;
      } else {
        value = draft.trim() || null;
      }

      const { error } = await supabase
        .from('clients')
        .update({ [editing]: value })
        .eq('id', client.id);
      if (error) throw error;
      toast.success('Saved');
      await qc.invalidateQueries({ queryKey: ['client', client.id] });
      cancelEdit();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const Row = ({
    label,
    field,
    display,
    inputType = 'text',
    placeholder,
  }: {
    label: string;
    field: FieldKey;
    display: React.ReactNode;
    inputType?: string;
    placeholder?: string;
  }) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        {editing === field ? (
          <div className="flex items-center gap-1.5 mt-1">
            <Input
              type={inputType}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="h-8 text-sm"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save} disabled={saving}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-sm">{display}</p>
        )}
      </div>
      {editing !== field && (
        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-50 hover:opacity-100" onClick={() => startEdit(field)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  const altList = client.alternate_addresses ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Identity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Row label="DOB" field="date_of_birth" display={formatDOB(client.date_of_birth)} inputType="date" />
        <Row
          label="Current Address"
          field="current_address"
          display={client.current_address || '—'}
          placeholder="123 Main St, City, ST 00000"
        />
        <Row label="SSN-4" field="ssn_last4" display={maskSSN(client.ssn_last4)} placeholder="1234" />
        <Row label="Phone" field="phone" display={formatPhone(client.phone)} placeholder="5551234567" />
        <Row label="Email" field="email" display={client.email || '—'} inputType="email" placeholder="name@example.com" />

        {/* Alternate Addresses */}
        <div className="py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Alternate Addresses</p>
            {editing !== 'alternate_addresses' ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-50 hover:opacity-100"
                onClick={() => startEdit('alternate_addresses')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save} disabled={saving}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          {editing === 'alternate_addresses' ? (
            <div className="space-y-2 mt-2">
              {draftList.map((addr, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={addr}
                    onChange={(e) => {
                      const next = [...draftList];
                      next[i] = e.target.value;
                      setDraftList(next);
                    }}
                    placeholder="Prior address"
                    className="h-8 text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setDraftList(draftList.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setDraftList([...draftList, ''])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add alternate address
              </Button>
            </div>
          ) : altList.length === 0 ? (
            <p className="text-sm mt-1">None</p>
          ) : (
            <ul className="text-sm mt-1 list-disc list-inside space-y-0.5">
              {altList.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}