import { subMonths, startOfMonth, format as dfFormat } from 'date-fns';
import { es } from 'date-fns/locale';
import { computeNetWorth, listAssetsWithValues, listLiabilities } from '@/lib/queries/portfolio';
import { db } from '@/lib/db';
import { PatrimonioView } from './PatrimonioView';
import { ASSET_TYPE_LABELS } from '@/lib/types';
import type { AssetType } from '@/lib/types';

const ASSET_COLORS: Record<AssetType, string> = {
  cash_usd: '#4ade80',
  cash_ars: '#22d3ee',
  stock: '#8b5cf6',
  crypto: '#fb923c',
  property: '#a78bfa',
  other: '#71717a',
};

export async function PatrimonioPage() {
  const [nw, assets, liabilities, snapshots] = await Promise.all([
    computeNetWorth(),
    listAssetsWithValues(),
    listLiabilities(),
    db.snapshot.findMany({
      where: { date: { gte: subMonths(startOfMonth(new Date()), 23) } },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Build 24-month history, picking last snapshot per month.
  const byMonth = new Map<string, (typeof snapshots)[number]>();
  for (const s of snapshots) {
    const k = dfFormat(s.date, 'yyyy-MM');
    byMonth.set(k, s);
  }
  const history: Array<{ date: string; valueUsd: number; assetsUsd: number; liabilitiesUsd: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const d = subMonths(startOfMonth(new Date()), i);
    const k = dfFormat(d, 'yyyy-MM');
    const snap = byMonth.get(k);
    history.push({
      date: dfFormat(d, 'MMM yy', { locale: es }),
      valueUsd: snap ? Number(snap.netWorthUsd) : i === 0 ? nw.netWorthUsd : 0,
      assetsUsd: snap ? Number(snap.assetsUsd) : i === 0 ? nw.assetsUsd : 0,
      liabilitiesUsd: snap ? Number(snap.liabilitiesUsd) : i === 0 ? nw.liabilitiesUsd : 0,
    });
  }

  // Asset breakdown by type.
  const byType = new Map<AssetType, number>();
  for (const a of assets) {
    byType.set(a.type, (byType.get(a.type) ?? 0) + a.valueUsd);
  }
  const totalAssets = Array.from(byType.values()).reduce((s, v) => s + v, 0) || 1;
  const assetBreakdown = Array.from(byType.entries()).map(([type, valueUsd]) => ({
    type,
    label: ASSET_TYPE_LABELS[type],
    valueUsd,
    pct: (valueUsd / totalAssets) * 100,
    color: ASSET_COLORS[type],
  }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Patrimonio</h1>
        <p className="mt-0.5 text-[11px] text-fg-subtle">
          Activos menos deudas · histórico mes a mes · tasa {nw.rateType.toUpperCase()}
        </p>
      </header>

      <PatrimonioView
        netWorth={nw}
        history={history}
        assetBreakdown={assetBreakdown}
        totalAssetsUsd={nw.assetsUsd}
        accounts={assets
          .filter((a) => a.kind === 'wallet')
          .map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            ticker: a.ticker,
            currency: a.currency,
            quantity: a.quantity,
            valueNative: a.valueNative,
            valueUsd: a.valueUsd,
          }))}
        objects={assets
          .filter((a) => a.kind === 'object')
          .map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            currency: a.currency,
            quantity: a.quantity,
            valueNative: a.valueNative,
            valueUsd: a.valueUsd,
          }))}
        liabilities={liabilities.map((l) => ({
          id: l.id,
          name: l.name,
          amount: Number(l.amount),
          currency: l.currency as 'USD' | 'ARS',
          dueDate: l.dueDate ? l.dueDate.toISOString().slice(0, 10) : null,
          note: l.note,
        }))}
      />
    </div>
  );
}
