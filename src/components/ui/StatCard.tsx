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
  className?: string;
}

const variantStyles = {
  default: 'bg-card',
  danger: 'bg-card border-l-4 border-l-state-violation',
  warning: 'bg-card border-l-4 border-l-state-active',
  success: 'bg-card border-l-4 border-l-state-resolved',
};

const iconVariantStyles = {
  default: 'bg-secondary text-foreground',
  danger: 'bg-state-violation/10 text-state-violation',
  warning: 'bg-state-active/10 text-state-active',
  success: 'bg-state-resolved/10 text-state-resolved',
};

export function StatCard({ label, value, icon: Icon, trend, variant = 'default', className }: StatCardProps) {
  return (
    <div className={cn("stat-card", variantStyles[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p className={cn(
              "text-sm font-medium",
              trend.isPositive ? "text-state-resolved" : "text-state-violation"
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
