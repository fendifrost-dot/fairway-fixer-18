import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WeeklyUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export function WeeklyUpdateDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: WeeklyUpdateDialogProps) {
  const [roundId, setRoundId] = useState<string>('latest');
  const [includeDates, setIncludeDates] = useState(false);
  const [customSummary, setCustomSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: rounds = [] } = useQuery({
    queryKey: ['dispute-rounds', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_rounds')
        .select('id, round_number')
        .eq('client_id', clientId)
        .order('round_number', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!clientId,
  });

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const resolvedRoundId = roundId === 'latest' ? undefined : roundId;
      const { data, error } = await supabase.functions.invoke('generate-weekly-update', {
        body: {
          client_id: clientId,
          round_id: resolvedRoundId,
          include_dates_in_body: includeDates,
          custom_status_summary: customSummary.trim() || null,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.download_url) {
        const a = document.createElement('a');
        a.href = data.download_url;
        a.download = data.file_name ?? 'Weekly_Update.docx';
        a.click();
      } else if (data.buffer_base64) {
        const bytes = Uint8Array.from(atob(data.buffer_base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.file_name ?? 'Weekly_Update.docx';
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success('Weekly update generated and logged to timeline');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Weekly Update</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          Client: <span className="font-medium">{clientName}</span>
        </p>
        <div>
          <Label>Round to include</Label>
          <Select value={roundId} onValueChange={setRoundId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest round</SelectItem>
              {rounds.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  Round {r.round_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="include-dates" checked={includeDates} onCheckedChange={setIncludeDates} />
          <Label htmlFor="include-dates">Include dates in body (default: off)</Label>
        </div>
        <div>
          <Label>Custom Status Summary (optional)</Label>
          <Textarea
            placeholder="Leave blank to auto-generate from this round's events"
            value={customSummary}
            onChange={(e) => setCustomSummary(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
