import type { NormalizedPrice } from './coingecko';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchFrankfurterPair(from: string, to: string): Promise<NormalizedPrice> {
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`frankfurter request failed: ${res.status}`);
  }
  const data = (await res.json()) as FrankfurterResponse;
  return {
    ticker: `${from}/${to}`,
    price: data.rates[to] ?? 0,
    changePct24h: 0,
    fetchedAt: new Date(data.date),
  };
}
