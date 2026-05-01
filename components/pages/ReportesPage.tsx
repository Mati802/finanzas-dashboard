import { db } from '@/lib/db';
import { ReportesView } from './ReportesView';
import { convert, getDefaultRateType, getLatestRate } from '@/lib/convert';
import type { Currency } from '@/lib/types';

export async function ReportesPage({
  searchParams,
}: {
  searchParams?: { year?: string; from?: string; to?: string };
}) {
  const now = new Date();
  const year = Number(searchParams?.year ?? now.getFullYear());

  const defaultFrom = new Date(Date.UTC(year, 0, 1)).toISOString().slice(0, 10);
  const defaultTo = new Date(Date.UTC(year, 11, 31)).toISOString().slice(0, 10);
  const from = searchParams?.from ?? defaultFrom;
  const to = searchParams?.to ?? defaultTo;

  const rateType = await getDefaultRateType();
  const rate = (await getLatestRate(rateType)) ?? (await getLatestRate('blue'));
  const effective = rate ?? { buy: 1, sell: 1 };

  const [transactions, categories] = await Promise.all([
    db.transaction.findMany({
      where: {
        date: {
          gte: new Date(from + 'T00:00:00.000Z'),
          lte: new Date(to + 'T23:59:59.999Z'),
        },
      },
      include: { category: true },
      orderBy: { date: 'asc' },
    }),
    db.category.findMany(),
  ]);

  const rows = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    type: t.type as 'income' | 'expense',
    amount: Number(t.amount),
    currency: t.currency as Currency,
    amountUsd: convert(Number(t.amount), t.currency as Currency, 'USD', effective),
    categoryId: t.categoryId,
    categoryName: t.category.name,
    categoryKind: t.category.kind,
    note: t.note ?? '',
  }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Reportes</h1>
        <p className="mt-0.5 text-[11px] text-fg-subtle">
          Agrupaciones por categoría y tipo · filtros por rango · exportación CSV
        </p>
      </header>
      <ReportesView
        rows={rows}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        from={from}
        to={to}
        year={year}
      />
    </div>
  );
}
