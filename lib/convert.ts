import type { Currency, RateType } from './types';
import { db } from './db';

export type RatesMap = Partial<Record<RateType, { buy: number; sell: number }>>;

/** Tickers de stablecoins atadas al USD — se valúan a la tasa USDT. */
const STABLECOIN_TICKERS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDD']);

/**
 * Carga las cotizaciones más recientes para todos los tipos relevantes.
 * Se devuelven juntas para que el llamador pueda elegir la apropiada por
 * activo sin hacer múltiples queries.
 */
export async function getAllLatestRates(): Promise<RatesMap> {
  const rows = await db.exchangeRate.findMany({
    orderBy: { fetchedAt: 'desc' },
    distinct: ['type'],
  });
  const out: RatesMap = {};
  for (const r of rows) {
    out[r.type as RateType] = { buy: Number(r.buyPrice), sell: Number(r.sellPrice) };
  }
  return out;
}

/**
 * Reglas de conversión por activo (definidas por el usuario):
 *  - USDT y otras stables (cripto)  → tasa USDT (P2P)
 *  - Cualquier otra cripto (BTC/ETH) → tasa USDT (los exits típicos pasan por USDT)
 *  - cash_usd "físico"/"efectivo"   → tasa BLUE (dólar billete)
 *  - cash_usd resto (banco)         → tasa MEP (dólar bancario)
 *  - cash_ars y demás ARS           → tasa BLUE (referencia conservadora)
 *  - stock CEDEAR (en ARS)          → tasa MEP (BYMA usa MEP de referencia)
 *  - propiedades, otros             → tasa BLUE
 */
export function rateTypeForAsset(a: {
  name: string;
  type: string;
  ticker: string | null;
  currency: string;
}): RateType {
  if (a.type === 'crypto') {
    const t = (a.ticker ?? '').toUpperCase();
    if (STABLECOIN_TICKERS.has(t)) return 'usdt';
    return 'usdt';
  }
  if (a.type === 'cash_usd') {
    const n = a.name.toLowerCase();
    if (n.includes('físico') || n.includes('fisico') || n.includes('efectivo')) {
      return 'blue';
    }
    return 'mep';
  }
  if (a.type === 'stock') return 'mep';
  return 'blue';
}

/**
 * Selecciona la cotización para el tipo deseado, con fallbacks en cadena
 * para no romper si una rate temporalmente no se trajo.
 */
export function pickRate(
  rates: RatesMap,
  type: RateType
): { buy: number; sell: number } {
  return (
    rates[type] ?? rates.blue ?? rates.mep ?? rates.usdt ?? rates.oficial ?? { buy: 1, sell: 1 }
  );
}

/**
 * Obtiene la última tasa de cambio almacenada para un tipo dado.
 * Devuelve `null` si no hay registros.
 */
export async function getLatestRate(type: RateType): Promise<{ buy: number; sell: number } | null> {
  const row = await db.exchangeRate.findFirst({
    where: { type },
    orderBy: { fetchedAt: 'desc' },
  });
  if (!row) return null;
  return { buy: Number(row.buyPrice), sell: Number(row.sellPrice) };
}

/**
 * Obtiene el tipo de cotización por defecto configurado.
 * Si no hay setting, usa 'blue'.
 */
export async function getDefaultRateType(): Promise<RateType> {
  const row = await db.setting.findUnique({ where: { key: 'default_rate_type' } });
  return ((row?.value as RateType) ?? 'blue') as RateType;
}

/**
 * Convierte un monto entre USD y ARS usando la tasa de cambio provista
 * (se toma `sell` por default, que es la venta y la que "compra" pesos).
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rate: { buy: number; sell: number }
): number {
  if (from === to) return amount;
  if (from === 'USD' && to === 'ARS') return amount * rate.sell;
  // ARS -> USD
  return amount / rate.sell;
}

/**
 * Convierte un monto a USD usando la tasa por defecto.
 * Si falta la tasa, asume 1:1 (sin conversión) y avisa en consola.
 */
export async function toUSD(amount: number, currency: Currency, rateType?: RateType): Promise<number> {
  if (currency === 'USD') return amount;
  const type = rateType ?? (await getDefaultRateType());
  const rate = await getLatestRate(type);
  if (!rate) {
    console.warn(`[convert] no rate for ${type}; defaulting to 1:1`);
    return amount;
  }
  return convert(amount, currency, 'USD', rate);
}
