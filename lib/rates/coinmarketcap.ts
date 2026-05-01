import type { NormalizedPrice } from './coingecko';

interface CmcQuote {
  symbol: string;
  quote: {
    USD: {
      price: number;
      percent_change_24h: number;
      last_updated: string;
    };
  };
}

interface CmcQuoteResponse {
  status: { error_code: number; error_message: string | null };
  // CMC devuelve `CmcQuote` (objeto) para símbolos unambiguos, y
  // `CmcQuote[]` (array) cuando el mismo símbolo lo comparten múltiples
  // criptomonedas. Hay que soportar ambas formas.
  data: Record<string, CmcQuote | CmcQuote[]>;
}

const PRO_BASE = 'https://pro-api.coinmarketcap.com';
const SANDBOX_BASE = 'https://sandbox-api.coinmarketcap.com';

function getHeaders(): HeadersInit {
  const key = process.env.COINMARKETCAP_API_KEY ?? '';
  return {
    Accept: 'application/json',
    'X-CMC_PRO_API_KEY': key,
  };
}

/**
 * Fetches live prices from CoinMarketCap for an array of symbols (e.g., ['BTC','ETH','ADA']).
 * Uses the cryptocurrency quotes endpoint; stock tickers will return 400 and should be
 * routed to Yahoo instead.
 */
export async function fetchCoinMarketCapPrices(symbols: string[]): Promise<NormalizedPrice[]> {
  if (symbols.length === 0) return [];

  // Evitamos pegarle al endpoint si no hay API key — CMC responde 401 y
  // contamina los logs en cada render. Cuando se configure la key (ver
  // .env.example) este short-circuit deja de aplicar y todo funciona normal.
  const apiKey = process.env.COINMARKETCAP_API_KEY ?? '';
  if (apiKey.trim().length === 0) return [];

  const url = new URL('/v1/cryptocurrency/quotes/latest', PRO_BASE);
  url.searchParams.set('symbol', symbols.map((s) => s.toUpperCase()).join(','));
  url.searchParams.set('convert', 'USD');

  const doFetch = async (base: string) =>
    fetch(base + url.pathname + '?' + url.searchParams.toString(), {
      headers: getHeaders(),
      cache: 'no-store',
    });

  let res = await doFetch(PRO_BASE);
  // Fall back to sandbox for tests or when the plan has no credits left.
  if (!res.ok && (res.status === 401 || res.status === 402 || res.status === 403)) {
    res = await doFetch(SANDBOX_BASE);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`coinmarketcap request failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as CmcQuoteResponse;
  if (data.status?.error_code !== 0) {
    throw new Error(`coinmarketcap error: ${data.status?.error_message ?? 'unknown'}`);
  }

  const out: NormalizedPrice[] = [];
  for (const sym of symbols) {
    const entry = data.data[sym.toUpperCase()];
    // Soportamos ambas formas de respuesta (objeto o array): para símbolos
    // compartidos (ej. "BTC" que podría matchear múltiples) CMC devuelve un
    // array; para unambiguos, devuelve directamente el objeto.
    const first: CmcQuote | undefined = Array.isArray(entry) ? entry[0] : entry;
    if (!first) continue;
    const usd = first.quote?.USD;
    if (!usd) continue;
    out.push({
      ticker: sym,
      price: Number(usd.price) || 0,
      changePct24h: Number(usd.percent_change_24h) || 0,
      fetchedAt: usd.last_updated ? new Date(usd.last_updated) : new Date(),
    });
  }
  return out;
}
