import { Link } from 'react-router-dom';
import { ArrowRight, Clock, RefreshCcw, Loader2 } from 'lucide-react';
import { useReinsertionMatters } from '@/hooks/useDashboardData';
import { differenceInDays, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ReinsertionAlert() {
  const { data: reinsertionMatters = [], isLoading } = useReinsertionMatters();

  if (isLoading) {
    return (
      <div className="rounded-lg border-2 border-muted bg-muted/10 p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  
  if (reinsertionMatters.length === 0) return null;

  const reinsertionData = reinsertionMatters.map((matter: any) => {
    const relatedViolation = matter.violations?.find(
      (v: any) => v.trigger === 'Reinsertion611a5B'
    );
    const daysSinceReinsertion = relatedViolation 
      ? differenceInDays(new Date(), parseISO(relatedViolation.created_at))
      : 0;

    return {
      matter,
      daysSince: daysSinceReinsertion,
    };
  });

  return (
    <TooltipProvider>
      <div className="rounded-lg border-2 border-[hsl(var(--state-reinsertion))] bg-[hsl(var(--state-reinsertion))]/10 p-4 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-full bg-[hsl(var(--state-reinsertion))] text-white">
            <RefreshCcw className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-[hsl(var(--state-reinsertion))]">
                ⚠️ Reinsertion Detected — Immediate Action Required
              </h3>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs font-mono bg-[hsl(var(--state-reinsertion))]/20 text-[hsl(var(--state-reinsertion))] px-2 py-0.5 rounded">
                    §611(a)(5)(B)
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Reinsertion requires certification from the furnisher. Failure to certify is a per se violation.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="space-y-2">
              {reinsertionData.map(({ matter, daysSince }: { matter: any; daysSince: number }) => (
                <Link
                  key={matter.id}
                  to={`/matters/${matter.id}`}
                  className="flex items-center justify-between p-3 rounded-md bg-card/80 hover:bg-card transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {matter.client?.preferred_name || matter.client?.legal_name}
                      </p>
                      <p className="font-semibold text-foreground group-hover:text-[hsl(var(--state-reinsertion))] transition-colors">
                        {matter.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--state-reinsertion))]">
                      <Clock className="h-4 w-4" />
                      <span>{daysSince}d since reinsertion</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--state-reinsertion))] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
