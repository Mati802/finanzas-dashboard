import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/db';
import {
  refreshRatesIfStale,
  refreshMarketPricesIfStale,
  getLatestExchangeRates,
  getLatestMarketPrices,
} from '@/lib/rates';
import type { RateType, TickerSourceType } from '@/lib/types';
import { formatARS, formatUSD, formatNumber, formatCryptoPrice } from '@/lib/format';

export const dynamic = 'force-dynamic';

type TickerPayloadItem = {
  label: string;
  value: string;
  changePct: number | null;
};

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ items: [] });
  }
  // Attempt background refresh (silently ignore failures so the UI still renders).
  await Promise.allSettled([refreshRatesIfStale(), refreshMarketPricesIfStale()]);

  let rates, prices, items;
  try {
    [rates, prices, items] = await Promise.all([
      getLatestExchangeRates(),
      getLatestMarketPrices(),
      db.tickerItem.findMany({ where: { isVisible: true }, orderBy: { orderIndex: 'asc' } }),
    ]);
  } catch (err) {
    console.warn('[api/ticker] DB query failed', err);
    return NextResponse.json({ items: [] });
  }

  const rateByType = new Map(rates.map((r) => [r.type as RateType, r]));
  const priceByTicker = new Map(prices.map((p) => [p.ticker, p]));

  const payload: TickerPayloadItem[] = items.map((it) => {
    const st = it.sourceType as TickerSourceType;
    if (st === 'fx_ars') {
      const r = rateByType.get(it.sourceKey as RateType);
      return {
        label: it.displayLabel,
        value: r ? formatARS(Number(r.sellPrice)) : '—',
        changePct: null,
      };
    }
    if (st === 'crypto') {
      const p = priceByTicker.get(it.sourceKey);
      return {
        label: it.displayLabel,
        // formatCryptoPrice preserva 4 cifras significativas cuando el precio es < $1
        // (ej. ADA ~0.2567 en lugar de truncar a $0.25).
        value: p ? formatCryptoPrice(Number(p.price)) : '—',
        changePct: p ? Number(p.changePct24h) : null,
      };
    }
    if (st === 'stock' || st === 'index') {
      const p = priceByTicker.get(it.sourceKey);
      return {
        label: it.displayLabel,
        value: p ? formatNumber(Number(p.price), 2) : '—',
        changePct: p ? Number(p.changePct24h) : null,
      };
    }
    // fx_usd (e.g. USD/EUR) — not yet wired to a specific source, fall back to '—'
    return { label: it.displayLabel, value: '—', changePct: null };
  });

  return NextResponse.json({ items: payload });
}
