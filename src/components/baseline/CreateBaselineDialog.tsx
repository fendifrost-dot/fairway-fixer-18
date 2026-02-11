import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { parseBaselineText } from '@/lib/baselineParser';
import { toast } from 'sonner';
import type { CommitBaselineInput } from '@/hooks/useBaseline';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (input: CommitBaselineInput) => Promise<string>;
}

export function CreateBaselineDialog({ open, onOpenChange, onCommit }: Props) {
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      toast.error('Paste baseline text before submitting.');
      return;
    }

    const { items, warnings } = parseBaselineText(trimmed, { strict: false });

    if (items.length === 0) {
      toast.error(`No valid items extracted. ${warnings.length} warning(s).`);
      return;
    }

    setSubmitting(true);
    try {
      const input: CommitBaselineInput = {
        sourceType: 'note',
        originalText: trimmed,
        targets: items.map((item) => ({
          bureau: item.bureau,
          item_type: item.item_type,
          label: item.label,
          fingerprint: item.fingerprint,
          raw_fields: item.raw_fields,
        })),
      };

      await onCommit(input);

      if (warnings.length > 0) {
        toast.info(`Committed ${items.length} items. ${warnings.length} line(s) skipped.`);
      } else {
        toast.success(`Committed ${items.length} items.`);
      }

      setRawText('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to commit baseline.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Baseline</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder={"Paste baseline text here…\n\n## Experian\nAddresses\n123 Main St\nInquiries\nCapital One - 2024-01-15"}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={12}
          className="font-mono text-xs"
          disabled={submitting}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !rawText.trim()}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Commit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
