import 'server-only';
import { db } from '@/lib/db';
import { CEDEAR_LIST, fetchCedearQuotes } from '@/lib/rates/cedears';
import { getDefaultRateType, getLatestRate, convert } from '@/lib/convert';

const CEDEAR_TTL_MIN = 10;

export interface CedearRow {
  symbol: string;
  yahooSymbol: string;
  name: string;
  sector: string;
  priceArs: number;
  priceUsd: number;
  changePct24h: number;
  fetchedAt: Date | null;
}

function tickerKey(symbol: string): string {
  return `CEDEAR:${symbol}`;
}

async function readLatestFromDb(): Promise<Map<string, { price: number; changePct24h: number; fetchedAt: Date }>> {
  const rows = await db.marketPrice.findMany({
    where: { ticker: { startsWith: 'CEDEAR:' } },
    orderBy: { fetchedAt: 'desc' },
    distinct: ['ticker'],
  });
  const map = new Map<string, { price: number; changePct24h: number; fetchedAt: Date }>();
  for (const r of rows) {
    const sym = r.ticker.replace(/^CEDEAR:/, '');
    map.set(sym, {
      price: Number(r.price),
      changePct24h: Number(r.changePct24h),
      fetchedAt: r.fetchedAt,
    });
  }
  return map;
}

function isStale(map: Map<string, { fetchedAt: Date }>): boolean {
  if (map.size < CEDEAR_LIST.length / 2) return true;
  const now = Date.now();
  for (const v of map.values()) {
    if ((now - v.fetchedAt.getTime()) / 60000 >= CEDEAR_TTL_MIN) return true;
  }
  return false;
}

export async function refreshCedearQuotes(): Promise<number> {
  const quotes = await fetchCedearQuotes();
  if (quotes.length === 0) return 0;
  await db.marketPrice.createMany({
    data: quotes.map((q) => ({
      ticker: tickerKey(q.symbol),
      price: q.priceArs,
      changePct24h: q.changePct24h,
      fetchedAt: q.fetchedAt,
    })),
  });
  return quotes.length;
}

export async function getCedearQuotes(): Promise<CedearRow[]> {
  let latest = await readLatestFromDb();
  if (isStale(latest)) {
    try {
      await refreshCedearQuotes();
      latest = await readLatestFromDb();
    } catch (err) {
      console.warn('[cedears] refresh failed, serving cached values', err);
    }
  }

  const rateType = await getDefaultRateType();
  const rate = (await getLatestRate(rateType)) ?? (await getLatestRate('blue'));
  const effectiveRate = rate ?? { buy: 1, sell: 1 };

  return CEDEAR_LIST.map((meta) => {
    const r = latest.get(meta.symbol);
    const priceArs = r?.price ?? 0;
    const priceUsd = priceArs > 0 ? convert(priceArs, 'ARS', 'USD', effectiveRate) : 0;
    return {
      symbol: meta.symbol,
      yahooSymbol: `${meta.symbol}.BA`,
      name: meta.name,
      sector: meta.sector,
      priceArs,
      priceUsd,
      changePct24h: r?.changePct24h ?? 0,
      fetchedAt: r?.fetchedAt ?? null,
    };
  });
}
