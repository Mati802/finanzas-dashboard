import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDolarApiRates } from '@/lib/rates/dolarapi';

const SAMPLE_RESPONSE = [
  { casa: 'oficial', compra: 1050, venta: 1078, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'blue', compra: 1440, venta: 1465, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'bolsa', compra: 1390, venta: 1398, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'contadoconliqui', compra: 1405, venta: 1412, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'cripto', compra: 1450, venta: 1458, fechaActualizacion: '2026-04-21T10:00:00Z' },
];

describe('fetchDolarApiRates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an entry per known rate type with buy/sell prices', async () => {
    const rates = await fetchDolarApiRates();
    expect(rates).toHaveLength(5);
    const byType = Object.fromEntries(rates.map((r) => [r.type, r]));
    expect(byType.oficial).toMatchObject({ type: 'oficial', buyPrice: 1050, sellPrice: 1078 });
    expect(byType.blue).toMatchObject({ type: 'blue', buyPrice: 1440, sellPrice: 1465 });
    expect(byType.mep).toMatchObject({ type: 'mep', buyPrice: 1390, sellPrice: 1398 });
    expect(byType.ccl).toMatchObject({ type: 'ccl', buyPrice: 1405, sellPrice: 1412 });
    expect(byType.usdt).toMatchObject({ type: 'usdt', buyPrice: 1450, sellPrice: 1458 });
  });

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 500 })));
    await expect(fetchDolarApiRates()).rejects.toThrow(/dolarapi/i);
  });
});
