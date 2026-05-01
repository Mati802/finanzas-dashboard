import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCoinGeckoPrices } from '@/lib/rates/coingecko';

const SAMPLE = {
  bitcoin: { usd: 94820, usd_24h_change: -1.4 },
  cardano: { usd: 0.645, usd_24h_change: 2.1 },
};

describe('fetchCoinGeckoPrices', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns a NormalizedPrice per requested id', async () => {
    const prices = await fetchCoinGeckoPrices(['bitcoin', 'cardano']);
    expect(prices).toHaveLength(2);
    expect(prices[0]).toMatchObject({ ticker: 'bitcoin', price: 94820, changePct24h: -1.4 });
    expect(prices[1]).toMatchObject({ ticker: 'cardano', price: 0.645, changePct24h: 2.1 });
  });

  it('builds the ids query param correctly', async () => {
    const fetchSpy = vi.fn(
      async (..._args: unknown[]) => new Response(JSON.stringify(SAMPLE), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchSpy);
    await fetchCoinGeckoPrices(['bitcoin', 'cardano']);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain('ids=bitcoin%2Ccardano');
    expect(url).toContain('vs_currencies=usd');
    expect(url).toContain('include_24hr_change=true');
  });

  it('returns empty array when given no ids', async () => {
    const prices = await fetchCoinGeckoPrices([]);
    expect(prices).toEqual([]);
  });

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 500 })));
    await expect(fetchCoinGeckoPrices(['bitcoin'])).rejects.toThrow(/coingecko/i);
  });
});
