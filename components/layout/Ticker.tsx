'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type TickerPayload = {
  items: Array<{
    label: string;
    value: string;
    changePct: number | null;
  }>;
};

async function fetchTicker(): Promise<TickerPayload> {
  const res = await fetch('/api/ticker', { cache: 'no-store' });
  if (!res.ok) throw new Error('ticker failed');
  return res.json();
}

function Item({ label, value, changePct }: { label: string; value: string; changePct: number | null }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px]">
      <span className="font-semibold uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="font-semibold text-fg">{value}</span>
      {changePct != null && (
        <span
          className={cn(
            'text-[9px] font-semibold',
            changePct >= 0 ? 'text-positive' : 'text-negative'
          )}
        >
          {changePct >= 0 ? '+' : ''}
          {changePct.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export function Ticker() {
  const { data } = useQuery({
    queryKey: ['ticker'],
    queryFn: fetchTicker,
    refetchInterval: 5 * 60 * 1000, // every 5 min
    staleTime: 4 * 60 * 1000,
  });

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="border-b border-border-subtle bg-bg-sunken px-5 py-2.5 overflow-hidden">
        <span className="text-[10px] text-fg-subtle">Cargando cotizaciones…</span>
      </div>
    );
  }

  // Ticker estático: los items se muestran en una sola línea y, si no entran,
  // el usuario puede hacer scroll horizontal (barra oculta por CSS).
  return (
    <div className="border-b border-border-subtle bg-bg-sunken px-5 py-2.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-7 whitespace-nowrap">
        {items.map((item, i) => (
          <Item key={i} {...item} />
        ))}
      </div>
    </div>
  );
}
