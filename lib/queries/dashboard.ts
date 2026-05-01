import 'server-only';
import { subMonths, startOfMonth, format as dfFormat } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/db';
import { convert, getDefaultRateType, getLatestRate } from '@/lib/convert';
import { computeNetWorth, listAssetsWithValues } from './portfolio';
import { formatARS } from '@/lib/format';
import type { AssetType, Currency } from '@/lib/types';
import { ASSET_TYPE_LABELS } from '@/lib/types';

export interface DashboardData {
  netWorth: { valueUsd: number; valueArs: string; trendPct: number | null };
  monthlyIncome: { valueUsd: number; valueArs: string; trendPct: number | null };
  monthlyExpense: { valueUsd: number; valueArs: string; trendPct: number | null };
  monthlySavings: { valueUsd: number; valueArs: string; rate: number; trendPct: number | null };
  netWorthHistory: Array<{ date: string; valueUsd: number }>;
  yearComparison: Array<{ month: string; current: number; previous: number }>;
  cashflow: Array<{ month: string; income: number; expense: number; savings: number }>;
  categoryBreakdown: Array<{
    name: string;
    color: string;
    icon: string;
    total: number;
    pctOfMonth: number;
  }>;
  assetBreakdown: Array<{
    type: string;
    label: string;
    valueUsd: number;
    pct: number;
    color: string;
  }>;
  /** Desglose del patrimonio neto por categoría: cuentas, inversiones,
   * objetos y deudas. Suma de los 3 primeros menos deudas = netWorthUsd. */
  netWorthBreakdown: {
    walletsUsd: number;
    investmentsUsd: number;
    objectsUsd: number;
    liabilitiesUsd: number;
    totalAssetsUsd: number;
    walletCount: number;
    investmentCount: number;
    objectCount: number;
  };
}

const ASSET_COLORS: Record<AssetType, string> = {
  cash_usd: '#4ade80',
  cash_ars: '#22d3ee',
  stock: '#8b5cf6',
  crypto: '#fb923c',
  property: '#a78bfa',
  other: '#71717a',
};

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const rateType = await getDefaultRateType();
  const rate = (await getLatestRate(rateType)) ?? (await getLatestRate('blue'));
  const effective = rate ?? { buy: 1, sell: 1 };

  // --------- Net worth ---------
  const nw = await computeNetWorth();
  const lastSnap = await db.snapshot.findFirst({ orderBy: { date: 'desc' } });
  const priorSnap = await db.snapshot.findFirst({
    where: { date: { lt: startOfMonth(now) } },
    orderBy: { date: 'desc' },
  });
  const nwTrend = priorSnap
    ? ((nw.netWorthUsd - Number(priorSnap.netWorthUsd)) / Math.max(1, Number(priorSnap.netWorthUsd))) * 100
    : null;

  // --------- Monthly income / expense (current & previous month) ---------
  const currStart = new Date(Date.UTC(year, month, 1));
  const currEnd = new Date(Date.UTC(year, month + 1, 1));
  const prevStart = new Date(Date.UTC(year, month - 1, 1));
  const prevEnd = currStart;

  const [currTx, prevTx] = await Promise.all([
    db.transaction.findMany({
      where: { date: { gte: currStart, lt: currEnd } },
      select: { type: true, amount: true, currency: true, categoryId: true },
    }),
    db.transaction.findMany({
      where: { date: { gte: prevStart, lt: prevEnd } },
      select: { type: true, amount: true, currency: true },
    }),
  ]);

  const sum = (
    txs: Array<{ type: string; amount: unknown; currency: string }>,
    type: 'income' | 'expense'
  ) =>
    txs
      .filter((t) => t.type === type)
      .reduce(
        (s, t) =>
          s + convert(Number(t.amount), t.currency as Currency, 'USD', effective),
        0
      );

  const currIncome = sum(currTx, 'income');
  const currExpense = sum(currTx, 'expense');
  const prevIncome = sum(prevTx, 'income');
  const prevExpense = sum(prevTx, 'expense');
  const currSavings = currIncome - currExpense;
  const prevSavings = prevIncome - prevExpense;

  const pct = (curr: number, prev: number): number | null =>
    prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100;

  const savingsRate = currIncome > 0 ? (currSavings / currIncome) * 100 : 0;

  // --------- Net worth history (last 12 snapshots by month) ---------
  const monthsBack = 12;
  const history: Array<{ date: string; valueUsd: number }> = [];
  const snapshots = await db.snapshot.findMany({
    where: { date: { gte: subMonths(startOfMonth(now), monthsBack) } },
    orderBy: { date: 'asc' },
  });
  // Keep last snapshot per month
  const byMonth = new Map<string, (typeof snapshots)[number]>();
  for (const s of snapshots) {
    const k = dfFormat(s.date, 'yyyy-MM');
    byMonth.set(k, s);
  }
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = subMonths(startOfMonth(now), i);
    const k = dfFormat(d, 'yyyy-MM');
    const snap = byMonth.get(k);
    history.push({
      date: dfFormat(d, 'MMM', { locale: es }),
      valueUsd: snap ? Number(snap.netWorthUsd) : i === 0 ? nw.netWorthUsd : 0,
    });
  }

  // --------- Year comparison: income month-by-month ---------
  const comparison: Array<{ month: string; current: number; previous: number }> = [];
  const [currYearTx, prevYearTx] = await Promise.all([
    db.transaction.findMany({
      where: {
        type: 'income',
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { date: true, amount: true, currency: true },
    }),
    db.transaction.findMany({
      where: {
        type: 'income',
        date: { gte: new Date(Date.UTC(year - 1, 0, 1)), lt: new Date(Date.UTC(year, 0, 1)) },
      },
      select: { date: true, amount: true, currency: true },
    }),
  ]);
  const bucketIncomeByMonth = (rows: typeof currYearTx) => {
    const b = Array(12).fill(0);
    for (const r of rows) {
      const m = r.date.getUTCMonth();
      b[m] += convert(Number(r.amount), r.currency as Currency, 'USD', effective);
    }
    return b;
  };
  const currBuckets = bucketIncomeByMonth(currYearTx);
  const prevBuckets = bucketIncomeByMonth(prevYearTx);
  for (let m = 0; m < 12; m++) {
    comparison.push({
      month: dfFormat(new Date(year, m, 1), 'MMM', { locale: es }),
      current: currBuckets[m],
      previous: prevBuckets[m],
    });
  }

  // --------- Cashflow last 6 months ---------
  const cashflow: Array<{ month: string; income: number; expense: number; savings: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(startOfMonth(now), i);
    const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const rows = await db.transaction.findMany({
      where: { date: { gte: s, lt: e } },
      select: { type: true, amount: true, currency: true },
    });
    const income = sum(rows as any, 'income');
    const expense = sum(rows as any, 'expense');
    cashflow.push({
      month: dfFormat(d, 'MMM', { locale: es }),
      income,
      expense,
      savings: income - expense,
    });
  }

  // --------- Category breakdown (this month, expenses only) ---------
  const categories = await db.category.findMany();
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const catTotals = new Map<number, number>();
  for (const t of currTx) {
    if (t.type !== 'expense') continue;
    const usd = convert(Number(t.amount), t.currency as Currency, 'USD', effective);
    catTotals.set(t.categoryId, (catTotals.get(t.categoryId) ?? 0) + usd);
  }
  const totalExpense = currExpense || 1;
  const categoryBreakdown = Array.from(catTotals.entries()).map(([id, total]) => {
    const c = catMap.get(id)!;
    return {
      name: c.name,
      color: c.color,
      icon: c.icon,
      total,
      pctOfMonth: (total / totalExpense) * 100,
    };
  });

  // --------- Asset breakdown (donut) ---------
  const assets = await listAssetsWithValues();
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

  // --------- Net worth breakdown por kind ---------
  let walletsUsd = 0;
  let investmentsUsd = 0;
  let objectsUsd = 0;
  let walletCount = 0;
  let investmentCount = 0;
  let objectCount = 0;
  // ARS total derivado por suma de valueArs por activo (cada uno usa su tasa
  // adecuada: USDT, MEP, Blue, etc.). Es más preciso que multiplicar el total
  // USD por una sola cotización.
  const assetsArsTotal = assets.reduce((s, a) => s + a.valueArs, 0);
  for (const a of assets) {
    if (a.kind === 'wallet') {
      walletsUsd += a.valueUsd;
      walletCount++;
    } else if (a.kind === 'investment') {
      investmentsUsd += a.valueUsd;
      investmentCount++;
    } else if (a.kind === 'object') {
      objectsUsd += a.valueUsd;
      objectCount++;
    }
  }
  const liabilitiesArs = nw.liabilitiesUsd * effective.sell;
  const netWorthArs = assetsArsTotal - liabilitiesArs;

  return {
    netWorth: {
      valueUsd: nw.netWorthUsd,
      valueArs: formatARS(netWorthArs),
      trendPct: nwTrend,
    },
    monthlyIncome: {
      valueUsd: currIncome,
      valueArs: formatARS(currIncome * effective.sell),
      trendPct: pct(currIncome, prevIncome),
    },
    monthlyExpense: {
      valueUsd: currExpense,
      valueArs: formatARS(currExpense * effective.sell),
      trendPct: pct(currExpense, prevExpense),
    },
    monthlySavings: {
      valueUsd: currSavings,
      valueArs: formatARS(currSavings * effective.sell),
      rate: savingsRate,
      trendPct: pct(currSavings, prevSavings),
    },
    netWorthHistory: history,
    yearComparison: comparison,
    cashflow,
    categoryBreakdown,
    assetBreakdown,
    netWorthBreakdown: {
      walletsUsd,
      investmentsUsd,
      objectsUsd,
      liabilitiesUsd: nw.liabilitiesUsd,
      totalAssetsUsd: nw.assetsUsd,
      walletCount,
      investmentCount,
      objectCount,
    },
  };
}
