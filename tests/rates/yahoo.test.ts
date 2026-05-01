import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchYahooPrices } from '@/lib/rates/yahoo';

// Yahoo chart endpoint returns a "chart.result[0].meta" block with
// regularMarketPrice and chartPreviousClose / previousClose; we compute changePct.
function makeChartResponse(symbol: string, price: number, prev: number) {
  return {
    chart: {
      result: [
        {
          meta: {
            symbol,
            regularMarketPrice: price,
            chartPreviousClose: prev,
            previousClose: prev,
          },
        },
      ],
      error: null,
    },
  };
}

describe('fetchYahooPrices', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('%5EGSPC')) {
          return new Response(JSON.stringify(makeChartResponse('^GSPC', 5842.3, 5823.7)), { status: 200 });
        }
        if (url.includes('AAPL')) {
          return new Response(JSON.stringify(makeChartResponse('AAPL', 180, 177.34)), { status: 200 });
        }
        return new Response('not found', { status: 404 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns NormalizedPrice per symbol', async () => {
    const prices = await fetchYahooPrices(['^GSPC', 'AAPL']);
    expect(prices).toHaveLength(2);
    expect(prices[0].ticker).toBe('^GSPC');
    expect(prices[0].price).toBe(5842.3);
    expect(prices[0].changePct24h).toBeCloseTo(((5842.3 - 5823.7) / 5823.7) * 100, 2);
    expect(prices[1].ticker).toBe('AAPL');
    expect(prices[1].price).toBe(180);
    expect(prices[1].changePct24h).toBeCloseTo(((180 - 177.34) / 177.34) * 100, 2);
  });

  it('URL-encodes the ticker when calling the chart endpoint', async () => {
    const fetchSpy = vi.fn(
      async (..._args: unknown[]) =>
        new Response(JSON.stringify(makeChartResponse('^GSPC', 5842.3, 5823.7)), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await fetchYahooPrices(['^GSPC']);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain('%5EGSPC');
    expect(url).not.toContain('/^GSPC');
  });

  it('returns empty array when given no symbols', async () => {
    const prices = await fetchYahooPrices([]);
    expect(prices).toEqual([]);
  });
});
