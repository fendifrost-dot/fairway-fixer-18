import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseFurnisherUpdateText } from '@/lib/creditReport';

interface FurnisherUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onComplete?: () => void;
}

export function FurnisherUpdateDialog({
  open,
  onOpenChange,
  clientId,
  onComplete,
}: FurnisherUpdateDialogProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const parsed = parseFurnisherUpdateText(text);

      const { error: respErr } = await supabase
        .from('bureau_responses')
        .insert({
          client_id: clientId,
          bureau: parsed.bureau ?? null,
          response_date: parsed.date ?? new Date().toISOString().slice(0, 10),
          result: parsed.result,
          free_text: parsed.free_text,
        })
        .select()
        .single();

      if (respErr) throw respErr;

      await supabase.from('timeline_events').insert({
        client_id: clientId,
        category: 'Outcome',
        event_kind: 'outcome',
        source: parsed.bureau
          ? parsed.bureau.charAt(0).toUpperCase() + parsed.bureau.slice(1)
          : 'Other',
        title: `Bureau/furnisher update: ${parsed.result}`,
        summary: parsed.free_text.slice(0, 200),
        details: parsed.free_text,
        raw_line: `[Furnisher update] ${parsed.result}`,
        event_date: parsed.date ?? new Date().toISOString().slice(0, 10),
      });

      toast.success('Furnisher/bureau update recorded');
      setText('');
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Furnisher / Bureau Update</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Paste a reinvestigation result, furnisher letter, or deletion confirmation. Other tradelines are not affected.
        </p>
        <div>
          <Label>Update text</Label>
          <Textarea
            className="min-h-[160px]"
            placeholder="TransUnion reinvestigation 2026-05-01 — MOHELA verified as accurate..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!text.trim() || loading} onClick={handleSubmit}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
