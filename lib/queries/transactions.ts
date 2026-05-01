import 'server-only';
import { db, isDatabaseConfigured } from '@/lib/db';
import type { Currency, TransactionType } from '@/lib/types';

export interface TransactionWithCategory {
  id: number;
  date: Date;
  type: TransactionType;
  amount: number;
  currency: Currency;
  categoryId: number;
  note: string | null;
  createdAt: Date;
  category: {
    id: number;
    name: string;
    kind: string;
    icon: string;
    color: string;
    isRecurring: boolean;
  };
}

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export async function listTransactionsByMonth(
  year: number,
  month: number
): Promise<TransactionWithCategory[]> {
  if (!isDatabaseConfigured()) return [];
  const { start, end } = monthBounds(year, month);
  let rows;
  try {
    rows = await db.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  } catch (err) {
    console.warn('[transactions] listTransactionsByMonth failed', err);
    return [];
  }
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type as TransactionType,
    amount: Number(r.amount),
    currency: r.currency as Currency,
    categoryId: r.categoryId,
    note: r.note,
    createdAt: r.createdAt,
    category: {
      id: r.category.id,
      name: r.category.name,
      kind: r.category.kind,
      icon: r.category.icon,
      color: r.category.color,
      isRecurring: r.category.isRecurring,
    },
  }));
}

export async function listTransactionsByYear(year: number): Promise<TransactionWithCategory[]> {
  if (!isDatabaseConfigured()) return [];
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  let rows;
  try {
    rows = await db.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  } catch (err) {
    console.warn('[transactions] listTransactionsByYear failed', err);
    return [];
  }
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type as TransactionType,
    amount: Number(r.amount),
    currency: r.currency as Currency,
    categoryId: r.categoryId,
    note: r.note,
    createdAt: r.createdAt,
    category: {
      id: r.category.id,
      name: r.category.name,
      kind: r.category.kind,
      icon: r.category.icon,
      color: r.category.color,
      isRecurring: r.category.isRecurring,
    },
  }));
}

export interface MonthlyTotals {
  month: number;
  income: number;
  expense: number;
}

/**
 * Devuelve array de 12 posiciones (index 0 = enero).
 * Todos los montos se convierten a USD usando la tasa default almacenada.
 */
export async function getMonthlyTotals(year: number): Promise<MonthlyTotals[]> {
  const totals: MonthlyTotals[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: 0,
    expense: 0,
  }));
  if (!isDatabaseConfigured()) return totals;

  const { getLatestRate, getDefaultRateType, convert } = await import('@/lib/convert');
  const rateType = await getDefaultRateType();
  const rate = (await getLatestRate(rateType)) ?? (await getLatestRate('blue'));
  const effective = rate ?? { buy: 1, sell: 1 };

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  let rows;
  try {
    rows = await db.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true, type: true, amount: true, currency: true },
    });
  } catch (err) {
    console.warn('[transactions] getMonthlyTotals failed', err);
    return totals;
  }

  for (const r of rows) {
    const m = r.date.getUTCMonth();
    const usd = convert(Number(r.amount), r.currency as Currency, 'USD', effective);
    if (r.type === 'income') totals[m].income += usd;
    else totals[m].expense += usd;
  }
  return totals;
}
