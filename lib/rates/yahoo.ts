import type { NormalizedPrice } from './coingecko';

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }> | null;
    error: unknown;
  };
}

async function fetchOne(symbol: string): Promise<NormalizedPrice> {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      // Yahoo returns 401 for requests without a UA in some environments.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });
  if (!res.ok) {
    throw new Error(`yahoo request failed for ${symbol}: ${res.status}`);
  }
  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart.result?.[0];
  const meta = result?.meta;
  const price = Number(meta?.regularMarketPrice ?? 0);
  const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? price);
  const changePct24h = prev > 0 ? ((price - prev) / prev) * 100 : 0;
  return {
    ticker: symbol,
    price,
    changePct24h,
    fetchedAt: new Date(),
  };
}

export async function fetchYahooPrices(symbols: string[]): Promise<NormalizedPrice[]> {
  if (symbols.length === 0) return [];
  return Promise.all(symbols.map((s) => fetchOne(s)));
}
