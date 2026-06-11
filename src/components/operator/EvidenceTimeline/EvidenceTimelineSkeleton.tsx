import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function EvidenceTimelineSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-3 w-[55%]" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
