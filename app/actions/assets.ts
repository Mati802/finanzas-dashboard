'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fetchCryptoPrices } from '@/lib/rates';
import { CEDEAR_LIST, fetchCedearQuotes } from '@/lib/rates/cedears';
import { generateDailySnapshot } from '@/lib/snapshot';

// El campo `priceSource` se mantiene en la DB por compatibilidad con filas
// viejas (valores 'yahoo'/'coingecko' existentes). Para assets nuevos siempre
// se graba 'coinmarketcap' (si hay ticker) o 'manual' (si no).
const AssetSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  type: z.enum(['cash_usd', 'cash_ars', 'stock', 'crypto', 'property', 'other']),
  kind: z.enum(['wallet', 'investment', 'object']).default('investment'),
  quantity: z.coerce.number(),
  ticker: z.string().optional(),
  manualValue: z.coerce.number().optional(),
  currency: z.enum(['USD', 'ARS']),
});

export async function upsertAsset(formData: FormData) {
  const raw = {
    id: formData.get('id') ? Number(formData.get('id')) : undefined,
    name: String(formData.get('name') ?? '').trim(),
    type: String(formData.get('type') ?? 'other') as z.infer<typeof AssetSchema>['type'],
    kind: (String(formData.get('kind') ?? 'investment') as 'wallet' | 'investment' | 'object'),
    quantity: Number(formData.get('quantity') ?? 0),
    ticker: (String(formData.get('ticker') ?? '').trim() || undefined) as string | undefined,
    manualValue: formData.get('manualValue') ? Number(formData.get('manualValue')) : undefined,
    currency: String(formData.get('currency') ?? 'USD') as 'USD' | 'ARS',
  };
  const parsed = AssetSchema.parse(raw);

  // Fuente de precio: implícita — CMC si hay ticker, manual si no. Se guarda
  // en la DB como texto libre; no hay UI para elegirla.
  const priceSource: 'coinmarketcap' | 'manual' = parsed.ticker ? 'coinmarketcap' : 'manual';

  if (parsed.id) {
    await db.asset.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        type: parsed.type,
        kind: parsed.kind,
        quantity: parsed.quantity,
        ticker: parsed.ticker ?? null,
        priceSource,
        manualValue: parsed.manualValue ?? null,
        currency: parsed.currency,
      },
    });
  } else {
    await db.asset.create({
      data: {
        name: parsed.name,
        type: parsed.type,
        kind: parsed.kind,
        quantity: parsed.quantity,
        ticker: parsed.ticker ?? null,
        priceSource,
        manualValue: parsed.manualValue ?? null,
        currency: parsed.currency,
      },
    });
  }

  // Carga el precio inicial según el tipo de activo:
  //  - CEDEAR (type=stock con ticker en CEDEAR_LIST) → Yahoo `.BA` (ARS)
  //  - cripto / otros con ticker → CoinMarketCap (con fallback a CoinGecko)
  if (parsed.ticker) {
    const tickerUpper = parsed.ticker.toUpperCase();
    const isCedear =
      parsed.type === 'stock' && CEDEAR_LIST.some((c) => c.symbol === tickerUpper);

    if (isCedear) {
      try {
        const [quote] = await fetchCedearQuotes([tickerUpper]);
        if (quote && quote.priceArs > 0) {
          await db.marketPrice.create({
            data: {
              ticker: `CEDEAR:${tickerUpper}`,
              price: quote.priceArs,
              changePct24h: quote.changePct24h,
              fetchedAt: quote.fetchedAt,
            },
          });
        }
      } catch (err) {
        console.warn('[upsertAsset] initial CEDEAR fetch failed', err);
      }
    } else {
      try {
        const [price] = await fetchCryptoPrices([parsed.ticker]);
        if (price && price.price > 0) {
          await db.marketPrice.create({
            data: {
              // Guardamos el símbolo del asset para que listAssetsWithValues pueda
              // matchear case-sensitive contra a.ticker.
              ticker: parsed.ticker,
              price: price.price,
              changePct24h: price.changePct24h,
              fetchedAt: price.fetchedAt,
            },
          });
        }
      } catch (err) {
        console.warn('[upsertAsset] initial price fetch failed', err);
      }
    }
  }

  await generateDailySnapshot().catch(() => {});
  revalidatePath('/');
  revalidatePath('/inversiones');
  revalidatePath('/patrimonio');
}

export async function deleteAsset(id: number) {
  await db.asset.delete({ where: { id } });
  await generateDailySnapshot().catch(() => {});
  revalidatePath('/');
  revalidatePath('/inversiones');
  revalidatePath('/patrimonio');
}

/**
 * Refresca los precios de los assets si los últimos datos de mercado están
 * desactualizados (>2 min) o no existen. Se llama desde la página de
 * Inversiones al cargar, así el usuario ve valores en vivo sin tener que
 * apretar "Actualizar".
 *
 * Importante: NO usa revalidatePath() porque corre durante render del
 * Server Component (Next.js 15 prohíbe revalidate dentro de render).
 */
export async function refreshAssetPricesIfStale(ttlMinutes = 2): Promise<void> {
  const assets = await db.asset.findMany({
    where: { ticker: { not: null }, type: { in: ['crypto', 'stock', 'other'] } },
  });
  if (assets.length === 0) return;

  const tickers = Array.from(new Set(assets.map((a) => a.ticker!)));
  // Traemos TODOS los market prices recientes y filtramos case-insensitive acá
  // (Prisma/SQLite no soporta `mode: 'insensitive'`).
  const latest = await db.marketPrice.findMany({
    orderBy: { fetchedAt: 'desc' },
    distinct: ['ticker'],
  });
  const byTicker = new Map(latest.map((m) => [m.ticker.toUpperCase(), m]));

  const stale = tickers.some((t) => {
    const row = byTicker.get(t.toUpperCase());
    if (!row) return true;
    const ageMin = (Date.now() - row.fetchedAt.getTime()) / 60000;
    return ageMin >= ttlMinutes;
  });
  if (!stale) return;

  try {
    await fetchAndPersistAssetPrices();
  } catch (err) {
    console.warn('[refreshAssetPricesIfStale] refresh failed', err);
  }
}

/**
 * Lógica interna: trae precios de CMC y los persiste. No revalida rutas
 * (eso lo hace el server action público `refreshAssetPrices`). Se aísla
 * acá para poder llamarla durante render sin violar las reglas de Next.
 */
async function fetchAndPersistAssetPrices(): Promise<void> {
  const assets = await db.asset.findMany({
    where: { ticker: { not: null } },
  });
  if (assets.length === 0) {
    await generateDailySnapshot().catch(() => {});
    return;
  }

  // Separamos CEDEARs (Yahoo `.BA` en ARS) del resto (CMC + fallback CoinGecko).
  const cedearSymbols = new Set(CEDEAR_LIST.map((c) => c.symbol));
  const cedearTickers = new Set<string>();
  const cryptoTickers = new Set<string>();
  for (const a of assets) {
    const t = (a.ticker ?? '').toUpperCase();
    if (!t) continue;
    if (a.type === 'stock' && cedearSymbols.has(t)) {
      cedearTickers.add(t);
    } else {
      // Conservamos el casing original para que matchee con `byTicker`.
      cryptoTickers.add(a.ticker!);
    }
  }

  if (cedearTickers.size > 0) {
    try {
      const quotes = await fetchCedearQuotes(Array.from(cedearTickers));
      for (const q of quotes) {
        if (q.priceArs <= 0) continue;
        await db.marketPrice.create({
          data: {
            ticker: `CEDEAR:${q.symbol}`,
            price: q.priceArs,
            changePct24h: q.changePct24h,
            fetchedAt: q.fetchedAt,
          },
        });
      }
    } catch (err) {
      console.warn('[fetchAndPersistAssetPrices] CEDEAR fetch failed', err);
    }
  }

  if (cryptoTickers.size > 0) {
    try {
      const prices = await fetchCryptoPrices(Array.from(cryptoTickers));
      for (const p of prices) {
        if (p.price <= 0) continue;
        const assetTicker =
          Array.from(cryptoTickers).find(
            (t) => t.toUpperCase() === p.ticker.toUpperCase()
          ) ?? p.ticker;
        await db.marketPrice.create({
          data: {
            ticker: assetTicker,
            price: p.price,
            changePct24h: p.changePct24h,
            fetchedAt: p.fetchedAt,
          },
        });
      }
    } catch (err) {
      console.warn('[fetchAndPersistAssetPrices] crypto fetch failed', err);
    }
  }

  await generateDailySnapshot().catch(() => {});
}

/**
 * Refresca los precios de mercado de todos los assets con ticker, usando
 * exclusivamente CoinMarketCap. Assets sin ticker (cash, propiedades) no
 * tocan la API — su valor viene de `manualValue` directamente.
 */
export async function refreshAssetPrices() {
  await fetchAndPersistAssetPrices();
  revalidatePath('/');
  revalidatePath('/inversiones');
  revalidatePath('/patrimonio');
}
