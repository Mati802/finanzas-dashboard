import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFrankfurterPair } from '@/lib/rates/frankfurter';

describe('fetchFrankfurterPair', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ amount: 1, base: 'EUR', date: '2026-04-21', rates: { USD: 1.08 } }),
          { status: 200 },
        ),
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns rate for pair EUR → USD', async () => {
    const price = await fetchFrankfurterPair('EUR', 'USD');
    expect(price).toMatchObject({ ticker: 'EUR/USD', price: 1.08, changePct24h: 0 });
  });

  it('builds URL with from and to params', async () => {
    const fetchSpy = vi.fn(
      async (..._args: unknown[]) =>
        new Response(
          JSON.stringify({ amount: 1, base: 'EUR', date: '2026-04-21', rates: { USD: 1.08 } }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await fetchFrankfurterPair('EUR', 'USD');
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain('from=EUR');
    expect(url).toContain('to=USD');
  });

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 500 })));
    await expect(fetchFrankfurterPair('EUR', 'USD')).rejects.toThrow(/frankfurter/i);
  });
});
