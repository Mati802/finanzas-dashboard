import { db, isDatabaseConfigured } from '@/lib/db';
import type { RateType, TickerSourceType } from '@/lib/types';
import { fetchDolarApiRates, type NormalizedRate } from './dolarapi';
import { fetchCoinMarketCapPrices } from './coinmarketcap';
import { fetchCoinGeckoPrices, type NormalizedPrice } from './coingecko';
import { symbolToCoingeckoId } from './crypto-list';

export type { NormalizedRate } from './dolarapi';
export type { NormalizedPrice } from './coingecko';

const RATES_TTL_MIN = 5;
const MARKET_TTL_MIN = 2;

function minutesAgo(date: Date): number {
  return (Date.now() - date.getTime()) / 60000;
}

export async function getLatestExchangeRates() {
  if (!isDatabaseConfigured()) return [];
  try {
    return await db.exchangeRate.findMany({
      orderBy: { fetchedAt: 'desc' },
      distinct: ['type'],
    });
  } catch (err) {
    console.warn('[rates] getLatestExchangeRates failed', err);
    return [];
  }
}

export async function getLatestMarketPrices() {
  if (!isDatabaseConfigured()) return [];
  try {
    return await db.marketPrice.findMany({
      orderBy: { fetchedAt: 'desc' },
      distinct: ['ticker'],
    });
  } catch (err) {
    console.warn('[rates] getLatestMarketPrices failed', err);
    return [];
  }
}

export async function refreshExchangeRates(): Promise<NormalizedRate[]> {
  const rates = await fetchDolarApiRates();
  if (rates.length) {
    await db.exchangeRate.createMany({
      data: rates.map((r) => ({
        type: r.type,
        buyPrice: r.buyPrice,
        sellPrice: r.sellPrice,
        fetchedAt: r.fetchedAt,
      })),
    });
  }
  return rates;
}

/**
 * Fetcher de precios de cripto. Usa CoinMarketCap si hay API key configurada;
 * si no, cae a CoinGecko (gratis, sin key) para los símbolos que estén en
 * `CRYPTO_LIST`. Símbolos desconocidos quedan sin precio y deben usar
 * `manualValue` como fallback.
 */
export async function fetchCryptoPrices(symbols: string[]): Promise<NormalizedPrice[]> {
  if (symbols.length === 0) return [];
  const hasCmcKey = (process.env.COINMARKETCAP_API_KEY ?? '').trim().length > 0;

  if (hasCmcKey) {
    try {
      const prices = await fetchCoinMarketCapPrices(symbols);
      if (prices.length > 0) return prices;
    } catch (err) {
      console.warn('[rates] CMC fetch failed, falling back to CoinGecko', err);
    }
  }

  // Fallback: CoinGecko mapea por id, no por symbol. Resolvemos los símbolos
  // conocidos de CRYPTO_LIST y devolvemos cada precio bajo el SYMBOL original
  // (no el id) para que matchee con el ticker del Asset.
  const idToSymbol = new Map<string, string>();
  for (const sym of symbols) {
    const id = symbolToCoingeckoId(sym);
    if (id) idToSymbol.set(id, sym.toUpperCase());
  }
  if (idToSymbol.size === 0) return [];

  try {
    const cgPrices = await fetchCoinGeckoPrices(Array.from(idToSymbol.keys()));
    return cgPrices
      .map((p) => {
        const sym = idToSymbol.get(p.ticker);
        return sym ? { ...p, ticker: sym } : null;
      })
      .filter((p): p is NormalizedPrice => p !== null && p.price > 0);
  } catch (err) {
    console.warn('[rates] CoinGecko fetch failed', err);
    return [];
  }
}

export async function refreshMarketPrices(): Promise<NormalizedPrice[]> {
  const tickerItems = await db.tickerItem.findMany({ where: { isVisible: true } });
  // CMC solo devuelve criptos. Los items de tipo 'stock' o 'index' del ticker
  // (ej. SP500) no se actualizan — podés ocultarlos desde Ajustes si molestan.
  const cryptos = tickerItems
    .filter((t) => (t.sourceType as TickerSourceType) === 'crypto')
    .map((t) => t.sourceKey);

  const cryptoPrices = cryptos.length
    ? await fetchCryptoPrices(cryptos).catch((err) => {
        console.error('crypto refresh failed', err);
        return [] as NormalizedPrice[];
      })
    : [];

  if (cryptoPrices.length) {
    await db.marketPrice.createMany({
      data: cryptoPrices.map((p) => ({
        ticker: p.ticker,
        price: p.price,
        changePct24h: p.changePct24h,
        fetchedAt: p.fetchedAt,
      })),
    });
  }
  return cryptoPrices;
}

export async function refreshMarketPricesIfStale() {
  const latest = await getLatestMarketPrices();
  const byTicker = new Map(latest.map((m) => [m.ticker, m]));

  const tickerItems = await db.tickerItem.findMany({ where: { isVisible: true } });
  const needsRefresh = tickerItems.some((t) => {
    const found = byTicker.get(t.sourceKey);
    return !found || minutesAgo(found.fetchedAt) >= MARKET_TTL_MIN;
  });

  if (needsRefresh) {
    await refreshMarketPrices();
  }
}

export async function refreshRatesIfStale() {
  const latest = await getLatestExchangeRates();
  const oldestOrMissing =
    latest.length < 5 ||
    Math.min(...latest.map((l) => minutesAgo(l.fetchedAt))) >= RATES_TTL_MIN;
  if (oldestOrMissing) {
    try {
      await refreshExchangeRates();
    } catch (err) {
      console.error('exchange rate refresh failed', err);
    }
  }
}

export interface RefreshSummary {
  exchangeRates: number;
  marketPrices: number;
  errors: string[];
}

/**
 * Calls every fetcher, persists results, and returns a summary.
 * Partial failures are collected in `errors` rather than thrown.
 */
export async function refreshAllRates(): Promise<RefreshSummary> {
  const errors: string[] = [];
  let exchangeRates = 0;
  let marketPrices = 0;

  const [ratesResult, pricesResult] = await Promise.allSettled([
    refreshExchangeRates(),
    refreshMarketPrices(),
  ]);

  if (ratesResult.status === 'fulfilled') {
    exchangeRates = ratesResult.value.length;
  } else {
    errors.push(`exchangeRates: ${String(ratesResult.reason)}`);
  }

  if (pricesResult.status === 'fulfilled') {
    marketPrices = pricesResult.value.length;
  } else {
    errors.push(`marketPrices: ${String(pricesResult.reason)}`);
  }

  return { exchangeRates, marketPrices, errors };
}

export type RateTypeAlias = RateType;
