import 'server-only';
import { subMonths, startOfMonth } from 'date-fns';
import { db } from '@/lib/db';
import { convert, getDefaultRateType, getLatestRate } from '@/lib/convert';
import { computeNetWorth } from '@/lib/queries/portfolio';
import type { Currency } from '@/lib/types';
import { formatUSD } from '@/lib/format';

/**
 * Genera un resumen textual del estado financiero del usuario que se
 * inyecta al system prompt del asistente. Incluye patrimonio neto, flujo
 * de los últimos 6 meses y top categorías de gasto.
 */
export async function buildFinancialContext(): Promise<string> {
  const now = new Date();
  const rateType = await getDefaultRateType();
  const rate = (await getLatestRate(rateType)) ?? (await getLatestRate('blue'));
  const effective = rate ?? { buy: 1, sell: 1 };

  const nw = await computeNetWorth().catch(() => null);

  const monthStart = startOfMonth(now);
  const sixMonthsAgo = subMonths(monthStart, 6);

  const txs = await db.transaction.findMany({
    where: { date: { gte: sixMonthsAgo } },
    include: { category: true },
    orderBy: { date: 'desc' },
  });

  // Flujo mensual últimos 6 meses
  const monthly: Record<string, { income: number; expense: number }> = {};
  for (const t of txs) {
    const k = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, '0')}`;
    const usd = convert(Number(t.amount), t.currency as Currency, 'USD', effective);
    monthly[k] = monthly[k] ?? { income: 0, expense: 0 };
    if (t.type === 'income') monthly[k].income += usd;
    else monthly[k].expense += usd;
  }

  // Top categorías de gasto últimos 3 meses
  const threeMonthsAgo = subMonths(monthStart, 3);
  const recentExpenses = txs.filter((t) => t.type === 'expense' && t.date >= threeMonthsAgo);
  const catTotals = new Map<string, { total: number; kind: string; count: number }>();
  for (const t of recentExpenses) {
    const prev = catTotals.get(t.category.name) ?? { total: 0, kind: t.category.kind, count: 0 };
    prev.total += convert(Number(t.amount), t.currency as Currency, 'USD', effective);
    prev.count += 1;
    catTotals.set(t.category.name, prev);
  }
  const topCats = Array.from(catTotals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  const lines: string[] = [];
  lines.push('=== RESUMEN FINANCIERO DEL USUARIO ===');
  lines.push(`Fecha actual: ${now.toISOString().slice(0, 10)}`);
  lines.push(`Tipo de cambio de referencia: ${rateType} (venta ARS/USD = ${effective.sell})`);
  if (nw) {
    lines.push(
      `Patrimonio neto: ${formatUSD(nw.netWorthUsd)} (activos ${formatUSD(nw.assetsUsd)} - pasivos ${formatUSD(nw.liabilitiesUsd)})`
    );
  }

  lines.push('\n--- Flujo mensual (últimos 6 meses, USD) ---');
  const sortedMonths = Object.keys(monthly).sort().slice(-6);
  for (const m of sortedMonths) {
    const d = monthly[m];
    const savings = d.income - d.expense;
    lines.push(
      `${m}: ingresos ${formatUSD(d.income)}, gastos ${formatUSD(d.expense)}, ahorro ${formatUSD(savings)}`
    );
  }

  if (topCats.length > 0) {
    lines.push('\n--- Top gastos últimos 3 meses ---');
    for (const [name, { total, kind, count }] of topCats) {
      lines.push(`${name} [${kind}]: ${formatUSD(total)} en ${count} movimientos`);
    }
  } else {
    lines.push('\n(Sin gastos registrados aún — el usuario recién está empezando a cargar datos.)');
  }

  return lines.join('\n');
}
