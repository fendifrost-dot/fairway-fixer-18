import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, FileText, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface DraftLettersPanelProps {
  clientId: string;
}

const LETTER_PRESETS = [
  { label: 'Verify or delete (MOV)', letterType: 'Method-of-Verification Demand', recipientType: 'cra' as const, recipientName: 'TransUnion' },
  { label: 'Furnisher §1681s-2 dispute', letterType: 'Furnisher Direct Dispute', recipientType: 'furnisher' as const, recipientName: 'Furnisher' },
  { label: 'Equifax bureau dispute', letterType: 'Bureau Dispute — Equifax', recipientType: 'cra' as const, recipientName: 'Equifax' },
  { label: 'Experian bureau dispute', letterType: 'Bureau Dispute — Experian', recipientType: 'cra' as const, recipientName: 'Experian' },
];

export function DraftLettersPanel({ clientId }: DraftLettersPanelProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ body: string; checklist: Record<string, unknown> } | null>(null);

  const { data: letters = [] } = useQuery({
    queryKey: ['dispute-letters', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_letters')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const draftLetter = async (preset: typeof LETTER_PRESETS[0]) => {
    setLoading(preset.label);
    try {
      const { data, error } = await supabase.functions.invoke('generate-dispute-letter', {
        body: {
          client_id: clientId,
          recipient_type: preset.recipientType,
          recipient_name: preset.recipientName,
          letter_type: preset.letterType,
        },
      });
      if (error) throw error;
      if (data.error) {
        if (data.needs_report) {
          toast.error('Import a credit report first — no tradeline data on file');
        } else {
          throw new Error(data.error);
        }
        return;
      }
      setPreview({ body: data.body_md, checklist: data.strength_checklist });
      toast.success('Letter drafted and saved to timeline');
      queryClient.invalidateQueries({ queryKey: ['dispute-letters', clientId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-events', clientId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Draft failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Draft Letters
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={!!loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Draft letters
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LETTER_PRESETS.map((p) => (
              <DropdownMenuItem key={p.label} onClick={() => draftLetter(p)}>
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {letters.length === 0 && !preview && (
          <p className="text-muted-foreground">No dispute letters yet. Import a report, then draft.</p>
        )}
        {letters.slice(0, 3).map((l) => (
          <div key={l.id} className="border rounded p-2">
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium">{l.letter_type as string}</span>
              <Badge variant="outline">{l.status as string}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{l.recipient_name as string}</p>
          </div>
        ))}
        {preview && (
          <div className="border rounded p-3 bg-muted/30 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium mb-1">Strength checklist</p>
            <ul className="text-xs list-disc pl-4 mb-2">
              {(preview.checklist.statutes_invoked as string[] | undefined)?.slice(0, 4).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <pre className="text-xs whitespace-pre-wrap font-mono">{preview.body.slice(0, 800)}…</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
