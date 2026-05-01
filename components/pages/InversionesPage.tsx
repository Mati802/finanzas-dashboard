import { listAssetsWithValues } from '@/lib/queries/portfolio';
import { refreshAssetPricesIfStale } from '@/app/actions/assets';
import { getCedearQuotes } from '@/lib/queries/cedears';
import { InversionesView } from './InversionesView';

export async function InversionesPage() {
  // Refresca precios en vivo si están desactualizados (>2 min). Corre en
  // background sin bloquear: si falla el fetch, seguimos renderizando los
  // valores que tengamos. Esto asegura que al abrir Inversiones los assets
  // con ticker siempre muestren un precio unitario y un 24H reales.
  await refreshAssetPricesIfStale().catch(() => {});
  const [allAssets, cedears] = await Promise.all([
    listAssetsWithValues(),
    getCedearQuotes().catch((err) => {
      console.warn('[InversionesPage] cedears load failed', err);
      return [];
    }),
  ]);
  // Inversiones solo lista posiciones (kind='investment'). Las wallets viven
  // en Patrimonio. Activos legacy sin kind ya fueron migrados a 'wallet'
  // por el bulk update.
  const assets = allAssets.filter((a) => a.kind === 'investment');
  const totalUsd = assets.reduce((s, a) => s + a.valueUsd, 0);
  // Subtotales: cripto en USD, CEDEARs en ARS (cotizan en BYMA).
  const totalCryptoUsd = assets
    .filter((a) => a.type === 'crypto')
    .reduce((s, a) => s + a.valueUsd, 0);
  const totalCedearArs = assets
    .filter((a) => a.type === 'stock')
    .reduce((s, a) => s + (a.currency === 'ARS' ? a.valueNative : 0), 0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Inversiones</h1>
        <p className="mt-0.5 text-[11px] text-fg-subtle">
          Portfolio con precios en vivo · actualizá para traer los últimos valores
        </p>
      </header>

      <InversionesView
        initial={assets.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          ticker: a.ticker,
          priceSource: a.priceSource,
          quantity: a.quantity,
          currency: a.currency,
          manualValue: a.manualValue,
          unitPrice: a.unitPrice,
          valueUsd: a.valueUsd,
          valueNative: a.valueNative,
          change24h: a.change24h,
        }))}
        totalUsd={totalUsd}
        totalCryptoUsd={totalCryptoUsd}
        totalCedearArs={totalCedearArs}
        cedears={cedears.map((c) => ({
          symbol: c.symbol,
          yahooSymbol: c.yahooSymbol,
          name: c.name,
          sector: c.sector,
          priceArs: c.priceArs,
          priceUsd: c.priceUsd,
          changePct24h: c.changePct24h,
          fetchedAt: c.fetchedAt ? c.fetchedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
