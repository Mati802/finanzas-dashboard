import { Building2, Landmark, LineChart, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatUSD } from '@/lib/format';

export interface NetWorthBreakdownProps {
  walletsUsd: number;
  investmentsUsd: number;
  objectsUsd: number;
  liabilitiesUsd: number;
  totalAssetsUsd: number;
  walletCount: number;
  investmentCount: number;
  objectCount: number;
}

interface SliceCardProps {
  label: string;
  value: number;
  pct: number;
  count: number | null;
  countLabel: string;
  Icon: typeof Landmark;
  color: string;
  bg: string;
  isLiability?: boolean;
}

function SliceCard({ label, value, pct, count, countLabel, Icon, color, bg, isLiability }: SliceCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-bg-elevated p-3 transition-colors hover:border-border/60',
        bg
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
          {label}
        </span>
        <div className="grid h-[22px] w-[22px] place-items-center rounded-md bg-[#17171f]">
          <Icon className={cn('h-3 w-3', color)} strokeWidth={2.5} />
        </div>
      </div>
      <div
        className={cn(
          'text-[16px] font-bold tabular-num',
          isLiability ? 'text-negative' : 'text-fg'
        )}
      >
        {isLiability ? '-' : ''}
        {formatUSD(value)}
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-fg-subtle">
        <span>
          {count != null ? `${count} ${countLabel}` : countLabel}
        </span>
        <span className="tabular-num">{pct.toFixed(1)}%</span>
      </div>
      {/* Progress bar */}
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-border-subtle">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            background: isLiability
              ? 'linear-gradient(90deg, #f87171, #ef4444)'
              : color.includes('green')
                ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
                : color.includes('orange')
                  ? 'linear-gradient(90deg, #fb923c, #f59e0b)'
                  : color.includes('violet')
                    ? 'linear-gradient(90deg, #a78bfa, #8b5cf6)'
                    : 'linear-gradient(90deg, #71717a, #52525b)',
          }}
        />
      </div>
    </div>
  );
}

export function NetWorthBreakdown({
  walletsUsd,
  investmentsUsd,
  objectsUsd,
  liabilitiesUsd,
  totalAssetsUsd,
  walletCount,
  investmentCount,
  objectCount,
}: NetWorthBreakdownProps) {
  const denom = Math.max(1, totalAssetsUsd);
  const pct = (v: number) => (v / denom) * 100;
  const liabPct = totalAssetsUsd > 0 ? (liabilitiesUsd / totalAssetsUsd) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-4">
      <SliceCard
        label="Cuentas / Bancos"
        value={walletsUsd}
        pct={pct(walletsUsd)}
        count={walletCount}
        countLabel={walletCount === 1 ? 'cuenta' : 'cuentas'}
        Icon={Landmark}
        color="text-[#4ade80]"
        bg="bg-[linear-gradient(180deg,rgba(74,222,128,0.1),transparent_60%)]"
      />
      <SliceCard
        label="Inversiones"
        value={investmentsUsd}
        pct={pct(investmentsUsd)}
        count={investmentCount}
        countLabel={investmentCount === 1 ? 'posición' : 'posiciones'}
        Icon={LineChart}
        color="text-[#fb923c]"
        bg="bg-[linear-gradient(180deg,rgba(251,146,60,0.1),transparent_60%)]"
      />
      <SliceCard
        label="Objetos / Bienes"
        value={objectsUsd}
        pct={pct(objectsUsd)}
        count={objectCount}
        countLabel={objectCount === 1 ? 'item' : 'items'}
        Icon={Building2}
        color="text-[#a78bfa]"
        bg="bg-[linear-gradient(180deg,rgba(167,139,250,0.1),transparent_60%)]"
      />
      <SliceCard
        label="Deudas"
        value={liabilitiesUsd}
        pct={liabPct}
        count={null}
        countLabel="vs activos totales"
        Icon={AlertCircle}
        color="text-[#f87171]"
        bg="bg-[linear-gradient(180deg,rgba(248,113,113,0.1),transparent_60%)]"
        isLiability
      />
    </div>
  );
}
