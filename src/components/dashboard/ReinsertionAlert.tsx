import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, RefreshCcw } from 'lucide-react';
import { mockMatters, mockEntityCases, mockViolations } from '@/data/mockData';
import { differenceInDays } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ReinsertionAlert() {
  // Find all reinsertion matters
  const reinsertionMatters = mockMatters.filter(m => m.primaryState === 'ReinsertionDetected');
  
  if (reinsertionMatters.length === 0) return null;

  const reinsertionData = reinsertionMatters.map(matter => {
    const relatedEntities = mockEntityCases.filter(e => e.matterId === matter.id);
    const relatedViolation = mockViolations.find(
      v => v.matterId === matter.id && v.trigger === 'Reinsertion611a5B'
    );
    const daysSinceReinsertion = relatedViolation 
      ? differenceInDays(new Date(), relatedViolation.createdAt)
      : 0;

    return {
      matter,
      entities: relatedEntities,
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
              {reinsertionData.map(({ matter, entities, daysSince }) => (
                <Link
                  key={matter.id}
                  to={`/matters/${matter.id}`}
                  className="flex items-center justify-between p-3 rounded-md bg-card/80 hover:bg-card transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-[hsl(var(--state-reinsertion))] transition-colors">
                        {matter.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entities.map(e => e.entityName).join(', ')}
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
