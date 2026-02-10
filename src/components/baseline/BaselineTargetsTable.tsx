import { useBaselineTargets } from '@/hooks/useBaseline';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Props {
  baselineId: string;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  still_present: 'destructive',
  not_found: 'outline',
};

export function BaselineTargetsTable({ baselineId }: Props) {
  const { data: targets, isLoading, error } = useBaselineTargets(baselineId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive py-4">Failed to load targets.</p>;
  }

  if (!targets || targets.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No targets in this baseline.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bureau</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Label</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {targets.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.bureau}</TableCell>
            <TableCell className="capitalize">{t.item_type}</TableCell>
            <TableCell>{t.label}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[t.status] ?? 'secondary'}>
                {t.status.replace('_', ' ')}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
