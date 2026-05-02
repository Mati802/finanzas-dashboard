import 'server-only';
import { db, isDatabaseConfigured } from '@/lib/db';
import {
  getDefaultRateType,
  getLatestRate,
  convert,
  getAllLatestRates,
  rateTypeForAsset,
  pickRate,
} from '@/lib/convert';
import type { Asset, Liability } from '@prisma/client';
import type { AssetKind, AssetType, Currency, PriceSource, RateType } from '@/lib/types';
import { CEDEAR_LIST } from '@/lib/rates/cedears';

// Stablecoins: cripto que vale ~1 USD. Cuando un asset crypto es stablecoin
// se trata como 'wallet' (saldo en exchange/billetera), no como inversión.
const STABLECOIN_TICKERS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'USDP', 'PYUSD',
]);

/**
 * Determina el `kind` (wallet | investment | object) de un asset.
 *
 * La clasificación se hace por la naturaleza del activo, no por lo que
 * tenga guardado en DB. Esto evita que filas con `kind` legacy o mal
 * seteado contaminen el desglose del patrimonio en el dashboard (donde
 * inversiones aparecían sumadas en "Cuentas / Bancos"):
 *
 *  - CEDEAR (type='stock')                  → siempre investment
 *  - propiedad/auto (type='property')       → siempre object
 *  - efectivo USD/ARS (type='cash_*')       → siempre wallet
 *  - crypto + ticker stablecoin (USDT…)    → siempre wallet (vale ~1 USD)
 *  - crypto + ticker no-stablecoin (BTC…)  → siempre investment
 *  - resto (other / crypto sin ticker)     → respeta storedKind, fallback wallet
 */
function resolveAssetKind(
  type: AssetType,
  ticker: string | null,
  storedKind: string | undefined | null
): AssetKind {
  if (type === 'stock') return 'investment';
  if (type === 'property') return 'object';
  if (type === 'cash_usd' || type === 'cash_ars') return 'wallet';

  if (type === 'crypto') {
    const t = ticker?.toUpperCase() ?? '';
    if (t) return STABLECOIN_TICKERS.has(t) ? 'wallet' : 'investment';
  }

  if (storedKind === 'wallet' || storedKind === 'investment' || storedKind === 'object') {
    return storedKind;
  }
  return 'wallet';
}

export interface AssetWithValue {
  id: number;
  name: string;
  type: AssetType;
  kind: AssetKind;
  ticker: string | null;
  priceSource: PriceSource | null;
  quantity: number;
  currency: Currency;
  manualValue: number | null;
  /** Per-unit price in the asset's currency (live market price if available, else manualValue). */
  unitPrice: number;
  /** Total value of this position expressed in USD. */
  valueUsd: number;
  /** Total value in the asset's native currency (unitPrice * quantity for live, or manualValue for manual). */
  valueNative: number;
  /** Total value en pesos argentinos, usando la tasa apropiada al activo. */
  valueArs: number;
  /** Tasa que se aplicó para convertir entre USD y ARS (blue/mep/usdt/etc.). */
  rateTypeUsed: RateType;
  /** Precio sell de la tasa usada (ARS por USD). */
  rateUsed: number;
  /** 24h change percentage, 0 when no market data. */
  change24h: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Devuelve los activos con el valor calculado en USD, usando el último precio
 * de mercado disponible por ticker. Para activos manuales (cash, propiedades)
 * se usa `manualValue` directamente.
 */
export async function listAssetsWithValues(): Promise<AssetWithValue[]> {
  if (!isDatabaseConfigured()) return [];
  let assets: Asset[];
  let marketPrices: { ticker: string; price: unknown; changePct24h: unknown; fetchedAt: Date }[];
  let allRates;
  try {
    [assets, marketPrices, allRates] = await Promise.all([
      db.asset.findMany({ orderBy: { createdAt: 'asc' } }),
      db.marketPrice.findMany({ orderBy: { fetchedAt: 'desc' } }),
      getAllLatestRates(),
    ]);
  } catch (err) {
    console.warn('[portfolio] DB query failed, returning empty', err);
    return [];
  }

  // Build latest-by-ticker map (findMany ordered desc, so the first entry per ticker is the latest).
  // La key es uppercase para que matchee sin importar el casing (BTC vs btc vs Btc).
  // Para CEDEARs guardamos también el precio bajo el símbolo "limpio" (sin
  // prefijo "CEDEAR:") para que un Asset con ticker='AAPL' (type 'stock') lo
  // matchee directo. La cotización viene en ARS desde Yahoo `.BA`.
  const byTicker = new Map<string, (typeof marketPrices)[number]>();
  const cedearTickers = new Set(CEDEAR_LIST.map((c) => c.symbol.toUpperCase()));
  for (const p of marketPrices) {
    const raw = p.ticker.toUpperCase();
    if (raw.startsWith('CEDEAR:')) {
      const sym = raw.replace(/^CEDEAR:/, '');
      if (!byTicker.has(sym)) byTicker.set(sym, p);
      continue;
    }
    if (!byTicker.has(raw)) byTicker.set(raw, p);
  }

  if (Object.keys(allRates).length === 0) {
    console.warn('[portfolio] no exchange rate found; defaulting 1:1 for ARS conversions');
  }

  return assets.map((a: Asset): AssetWithValue => {
    const qty = Number(a.quantity);
    const manual = a.manualValue == null ? null : Number(a.manualValue);
    let currency = a.currency as Currency;
    const tickerUpper = a.ticker?.toUpperCase();
    const live = tickerUpper ? byTicker.get(tickerUpper) : undefined;
    // Si el activo es un CEDEAR (stock con ticker en CEDEAR_LIST), su precio
    // vive en ARS aunque el usuario haya guardado currency='USD' por error.
    // Forzamos ARS para que la conversión a USD se haga vía blue.
    if (live && a.type === 'stock' && tickerUpper && cedearTickers.has(tickerUpper)) {
      currency = 'ARS';
    }

    // Determine per-unit price and total in native currency.
    let unitPrice: number;
    let valueNative: number;
    if (live) {
      unitPrice = Number(live.price);
      valueNative = unitPrice * qty;
    } else if (manual != null) {
      // Manual assets: manualValue is the full position value.
      valueNative = manual;
      unitPrice = qty > 0 ? manual / qty : manual;
    } else {
      valueNative = 0;
      unitPrice = 0;
    }

    // Tasa apropiada al activo: USDT P2P para cripto, MEP para USD bancario,
    // BLUE para USD billete, etc. (ver `rateTypeForAsset` en lib/convert.ts).
    const rateTypeUsed = rateTypeForAsset({
      name: a.name,
      type: a.type,
      ticker: a.ticker,
      currency: a.currency,
    });
    const effectiveRate = pickRate(allRates, rateTypeUsed);

    const valueUsd = convert(valueNative, currency, 'USD', effectiveRate);
    const valueArs = convert(valueNative, currency, 'ARS', effectiveRate);
    const change24h = live ? Number(live.changePct24h) : 0;

    return {
      id: a.id,
      name: a.name,
      type: a.type as AssetType,
      kind: resolveAssetKind(
        a.type as AssetType,
        a.ticker,
        (a as unknown as { kind?: string }).kind
      ),
      ticker: a.ticker,
      priceSource: (a.priceSource as PriceSource | null) ?? null,
      quantity: qty,
      currency,
      manualValue: manual,
      unitPrice,
      valueUsd,
      valueNative,
      valueArs,
      rateTypeUsed,
      rateUsed: effectiveRate.sell,
      change24h,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  });
}

/** Devuelve todas las deudas (sin procesar). */
export async function listLiabilities(): Promise<Liability[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    return await db.liability.findMany({ orderBy: [{ dueDate: 'asc' }, { id: 'asc' }] });
  } catch (err) {
    console.warn('[portfolio] listLiabilities failed', err);
    return [];
  }
}

export interface NetWorth {
  assetsUsd: number;
  liabilitiesUsd: number;
  netWorthUsd: number;
  /** Tipo de cotización usada para convertir ARS -> USD. */
  rateType: RateType;
  /** Precio de venta (ARS por USD) usado. */
  exchangeRateUsed: number;
}

/**
 * Calcula el patrimonio neto actual. Cada activo aporta su valor USD usando
 * la tasa que corresponde a su naturaleza (USDT, MEP, Blue, etc.); las deudas
 * usan la tasa por defecto.
 */
export async function computeNetWorth(): Promise<NetWorth> {
  if (!isDatabaseConfigured()) {
    return {
      assetsUsd: 0,
      liabilitiesUsd: 0,
      netWorthUsd: 0,
      rateType: 'blue',
      exchangeRateUsed: 1,
    };
  }
  let assets: AssetWithValue[];
  let liabilities: Liability[];
  let rateType: RateType;
  try {
    [assets, liabilities, rateType] = await Promise.all([
      listAssetsWithValues(),
      listLiabilities(),
      getDefaultRateType(),
    ]);
  } catch (err) {
    console.warn('[portfolio] computeNetWorth failed', err);
    return {
      assetsUsd: 0,
      liabilitiesUsd: 0,
      netWorthUsd: 0,
      rateType: 'blue',
      exchangeRateUsed: 1,
    };
  }

  const rate = (await getLatestRate(rateType)) ?? (await getLatestRate('blue'));
  if (!rate) {
    console.warn('[portfolio] no exchange rate available; falling back to 1:1');
  }
  const effectiveRate = rate ?? { buy: 1, sell: 1 };

  const assetsUsd = assets.reduce((sum, a) => sum + a.valueUsd, 0);
  const liabilitiesUsd = liabilities.reduce(
    (sum, l) =>
      sum + convert(Number(l.amount), l.currency as Currency, 'USD', effectiveRate),
    0
  );

  return {
    assetsUsd,
    liabilitiesUsd,
    netWorthUsd: assetsUsd - liabilitiesUsd,
    rateType,
    exchangeRateUsed: effectiveRate.sell,
  };
}
