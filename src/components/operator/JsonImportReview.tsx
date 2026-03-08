/**
 * JSON Import Review Panel
 * 
 * Displays a review table for pre-structured JSON event arrays.
 * Validates per-row, allows excluding invalid rows, then commits valid ones.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, AlertCircle, FileJson, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { JsonValidationResult, JsonValidationRow, mapValidatedToDb, ValidatedJsonEvent } from '@/lib/jsonImportValidator';
import { useBulkCreateTimelineEvents } from '@/hooks/useTimelineEvents';
import { ALL_SOURCES, EventSource, EventCategory, EVENT_CATEGORIES } from '@/types/operator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface JsonImportReviewProps {
  validation: JsonValidationResult;
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}

export function JsonImportReview({ validation, clientId, onDone, onCancel }: JsonImportReviewProps) {
  const [rows, setRows] = useState<JsonValidationRow[]>(validation.rows);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => {
    const valid = new Set<number>();
    validation.rows.forEach((r) => { if (r.valid) valid.add(r.index); });
    return valid;
  });

  const createEvents = useBulkCreateTimelineEvents();
  const isLoading = createEvents.isPending;

  const validSelected = rows.filter(r => r.valid && selectedIndices.has(r.index));

  const toggleRow = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    const allValidIndices = rows.filter(r => r.valid).map(r => r.index);
    if (allValidIndices.every(i => selectedIndices.has(i))) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(allValidIndices));
    }
  };

  // Allow per-row source/category overrides on valid rows
  const updateRowField = (index: number, field: 'source' | 'category', value: string) => {
    setRows(prev => prev.map(r => {
      if (r.index !== index || !r.validated) return r;
      const updated = { ...r.validated };
      if (field === 'source') {
        updated.source = value === '_null_' ? null : value as EventSource;
      } else if (field === 'category') {
        updated.category = value as EventCategory;
        updated.event_kind = value.toLowerCase();
      }
      return { ...r, validated: updated };
    }));
  };

  const handleCommit = async () => {
    const eventsToCommit = validSelected
      .map(r => r.validated!)
      .filter(Boolean);

    if (eventsToCommit.length === 0) {
      toast.error('No valid events selected');
      return;
    }

    try {
      const dbEvents = mapValidatedToDb(eventsToCommit, clientId);
      await createEvents.mutateAsync(dbEvents);
      toast.success(`JSON Import: ${dbEvents.length} events committed`);
      onDone();
    } catch (error) {
      toast.error('Commit failed: ' + (error as Error).message);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            JSON Import Review
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-600" />
              {validation.validCount} valid
            </span>
            {validation.invalidCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-destructive" />
                {validation.invalidCount} invalid
              </span>
            )}
            <span>/ {validation.totalCount} total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {validation.invalidCount > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {validation.invalidCount} row(s) have validation errors and cannot be imported. Valid rows can still be committed.
            </AlertDescription>
          </Alert>
        )}

        <div className="max-h-[400px] overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={validSelected.length === rows.filter(r => r.valid).length && validSelected.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-8">#</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24">Date</TableHead>
                <TableHead className="w-28">Source</TableHead>
                <TableHead className="w-24">Category</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow 
                  key={row.index} 
                  className={!row.valid ? 'bg-destructive/5 opacity-75' : selectedIndices.has(row.index) ? 'bg-primary/5' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIndices.has(row.index)}
                      onCheckedChange={() => toggleRow(row.index)}
                      disabled={!row.valid}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.index + 1}</TableCell>
                  <TableCell>
                    {row.valid ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 text-[10px]">Valid</Badge>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="destructive" className="text-[10px]">Invalid</Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[300px]">
                          <ul className="text-xs list-disc pl-3">
                            {row.errors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {row.warnings.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px] ml-1">⚠</Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[300px]">
                          <ul className="text-xs list-disc pl-3">
                            {row.warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {row.raw.event_date || <span className="text-muted-foreground italic">unknown</span>}
                  </TableCell>
                  <TableCell>
                    {row.valid && row.validated ? (
                      <Select
                        value={row.validated.source || '_null_'}
                        onValueChange={(v) => updateRowField(row.index, 'source', v)}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_null_">None</SelectItem>
                          {ALL_SOURCES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs">{row.raw.source || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.valid && row.validated ? (
                      <Select
                        value={row.validated.category}
                        onValueChange={(v) => updateRowField(row.index, 'category', v)}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs">{row.raw.category || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{row.raw.title}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{row.raw.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {validSelected.length} of {validation.validCount} valid rows selected for import
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCommit} disabled={isLoading || validSelected.length === 0}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Commit {validSelected.length} Events
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
