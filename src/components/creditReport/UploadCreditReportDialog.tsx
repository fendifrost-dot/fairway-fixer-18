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
import { pastDateBounds } from '@/lib/dateBounds';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { extractResponseDocumentText } from '@/lib/responseDocumentExtract';

export type ImportScope = 'full_snapshot' | 'partial_update' | 'furnisher_update';

interface UploadCreditReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onComplete?: () => void;
}

interface DiffSummary {
  added: number;
  updated: number;
  absent_in_latest: number;
  unchanged: number;
  disappeared: number;
}

export function UploadCreditReportDialog({
  open,
  onOpenChange,
  clientId,
  onComplete,
}: UploadCreditReportDialogProps) {
  const [text, setText] = useState('');
  const [scope, setScope] = useState<ImportScope>('full_snapshot');
  const [bureau, setBureau] = useState('transunion');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [furnisherFilter, setFurnisherFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ diff: DiffSummary; warnings: string[] } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'paste' | 'pdf' | 'image' | 'txt' | 'csv'>('paste');

  const inferSourceType = (file: File): typeof sourceType => {
    const name = file.name.toLowerCase();
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.txt') || file.type.startsWith('text/')) return 'txt';
    return 'paste';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSourceType(inferSourceType(file));
    setLoading(true);
    try {
      const extracted = await extractResponseDocumentText(file);
      if (!extracted.trim()) {
        throw new Error('No text could be extracted — try a clearer scan or paste structured text manually');
      }
      setText(extracted);
      toast.success('Document text extracted — review and parse before committing');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setLoading(false);
    }
  };

  const invokeIngest = async (dryRun: boolean) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ingest-credit-report', {
        body: {
          client_id: clientId,
          text,
          scope,
          bureau,
          report_date: reportDate,
          furnisher_filter: scope === 'furnisher_update' ? furnisherFilter : undefined,
          dry_run: dryRun,
          source_type: sourceType,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (dryRun) {
        setPreview({
          diff: data.diff.summary,
          warnings: (data.warnings ?? []).map((w: { reason: string }) => w.reason),
        });
        toast.success(
          `Preview: +${data.diff.summary.added} added, ${data.diff.summary.updated} updated, ${data.diff.summary.disappeared} absent`
        );
      } else {
        toast.success('Credit report imported successfully');
        onOpenChange(false);
        onComplete?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Credit Report</DialogTitle>
        </DialogHeader>

        <label className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-border hover:border-primary/50 block">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
            onChange={handleFileChange}
          />
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Click to upload PDF, PNG, JPG, TXT, or CSV — or paste structured text below
          </p>
          {fileName && (
            <p className="text-xs mt-2 flex items-center justify-center gap-1">
              <FileText className="h-3 w-3" /> {fileName}
            </p>
          )}
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Import scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as ImportScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_snapshot">Full bureau snapshot</SelectItem>
                <SelectItem value="partial_update">Partial update (no disappearances)</SelectItem>
                <SelectItem value="furnisher_update">Single furnisher update</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bureau</Label>
            <Select value={bureau} onValueChange={setBureau}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transunion">TransUnion</SelectItem>
                <SelectItem value="experian">Experian</SelectItem>
                <SelectItem value="equifax">Equifax</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Report date</Label>
            <input
              type="date"
              {...pastDateBounds()}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>
          {scope === 'furnisher_update' && (
            <div>
              <Label>Furnisher filter</Label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. MOHELA"
                value={furnisherFilter}
                onChange={(e) => setFurnisherFilter(e.target.value)}
              />
            </div>
          )}
        </div>

        <div>
          <Label>Structured report text</Label>
          <Textarea
            className="min-h-[200px] font-mono text-xs"
            placeholder={`## TransUnion\nMOHELA/SERVICING | 502935047818**** | 2004-09-07 | balance: $16,672\n2024-02 OK\n2024-03 60\n2024-04 OK`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!fileName) setSourceType('paste');
            }}
          />
        </div>

        {preview && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Diff preview</p>
            <p>+{preview.diff.added} added · {preview.diff.updated} updated · {preview.diff.disappeared} absent (non-destructive)</p>
            {preview.warnings.length > 0 && (
              <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" disabled={!text || loading} onClick={() => invokeIngest(true)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preview diff'}
          </Button>
          <Button disabled={!text || loading} onClick={() => invokeIngest(false)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Commit import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
