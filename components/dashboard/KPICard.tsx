import { cn } from '@/lib/utils';
import { formatMoney, formatPct } from '@/lib/format';
import type { Currency } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number;
  currency: Currency;
  sub: string;
  trend: number | null;
  icon: LucideIcon;
  variant: 'purple' | 'green' | 'red' | 'orange';
  negativeTrend?: boolean; // when true, positive trend renders red (e.g. gastos aumentando)
}

const VARIANT_BG: Record<KPICardProps['variant'], string> = {
  purple: 'bg-[linear-gradient(180deg,rgba(139,92,246,0.1),transparent_60%)]',
  green: 'bg-[linear-gradient(180deg,rgba(74,222,128,0.1),transparent_60%)]',
  red: 'bg-[linear-gradient(180deg,rgba(248,113,113,0.1),transparent_60%)]',
  orange: 'bg-[linear-gradient(180deg,rgba(251,146,60,0.1),transparent_60%)]',
};

const VARIANT_ICON: Record<KPICardProps['variant'], string> = {
  purple: 'text-[#a78bfa] bg-[#17171f]',
  green: 'text-[#4ade80] bg-[#17171f]',
  red: 'text-[#f87171] bg-[#17171f]',
  orange: 'text-[#fb923c] bg-[#17171f]',
};

export function KPICard({
  label,
  value,
  currency,
  sub,
  trend,
  icon: Icon,
  variant,
  negativeTrend,
}: KPICardProps) {
  const trendIsUp = (trend ?? 0) >= 0;
  const goodTrend = negativeTrend ? !trendIsUp : trendIsUp;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-bg-elevated p-4 transition-colors hover:border-border/60',
        VARIANT_BG[variant]
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
          {label}
        </span>
        <div className={cn('grid h-[22px] w-[22px] place-items-center rounded-md', VARIANT_ICON[variant])}>
          <Icon className="h-3 w-3" strokeWidth={2.5} />
        </div>
      </div>
      <div className="text-[17px] font-bold tabular-num text-fg">
        {formatMoney(value, currency)}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[10px]">
        {trend != null && (
          <span
            className={cn(
              'font-semibold',
              goodTrend ? 'text-positive' : 'text-negative'
            )}
          >
            {formatPct(trend, 1)}
          </span>
        )}
        <span className="text-fg-subtle">{sub}</span>
      </div>
    </div>
  );
}
