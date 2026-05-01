export interface NormalizedPrice {
  ticker: string;
  price: number;
  changePct24h: number;
  fetchedAt: Date;
}

type CoinGeckoResponse = Record<string, { usd: number; usd_24h_change: number }>;

export async function fetchCoinGeckoPrices(ids: string[]): Promise<NormalizedPrice[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  });
  const url = `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`coingecko request failed: ${res.status}`);
  }
  const data = (await res.json()) as CoinGeckoResponse;
  const now = new Date();
  return ids.map((id) => ({
    ticker: id,
    price: data[id]?.usd ?? 0,
    changePct24h: data[id]?.usd_24h_change ?? 0,
    fetchedAt: now,
  }));
}
