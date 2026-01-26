import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'danger' | 'warning' | 'success';
  size?: 'default' | 'compact';
  className?: string;
}

const variantStyles = {
  default: 'bg-card',
  danger: 'bg-card border-l-4 border-l-[hsl(var(--state-violation))]',
  warning: 'bg-card border-l-4 border-l-[hsl(var(--state-active))]',
  success: 'bg-card border-l-4 border-l-[hsl(var(--state-resolved))]',
};

const iconVariantStyles = {
  default: 'bg-secondary text-foreground',
  danger: 'bg-[hsl(var(--state-violation))]/10 text-[hsl(var(--state-violation))]',
  warning: 'bg-[hsl(var(--state-active))]/10 text-[hsl(var(--state-active))]',
  success: 'bg-[hsl(var(--state-resolved))]/10 text-[hsl(var(--state-resolved))]',
};

export function StatCard({ label, value, icon: Icon, trend, variant = 'default', size = 'default', className }: StatCardProps) {
  if (size === 'compact') {
    return (
      <div className={cn(
        "card-elevated p-3",
        variant !== 'default' && variantStyles[variant],
        className
      )}>
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", iconVariantStyles[variant])}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("stat-card", variantStyles[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p className={cn(
              "text-sm font-medium",
              trend.isPositive ? "text-[hsl(var(--state-resolved))]" : "text-[hsl(var(--state-violation))]"
            )}>
              {trend.isPositive ? '↓' : '↑'} {Math.abs(trend.value)}% from last week
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg", iconVariantStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
