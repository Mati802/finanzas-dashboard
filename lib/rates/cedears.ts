// CEDEARs cotizan en BYMA en ARS. Yahoo Finance los expone con sufijo `.BA`
// (ej. AAPL.BA, KO.BA). El precio devuelto ya incluye el ratio de conversión,
// así que no hace falta normalizarlo: lo que ves es lo que vale 1 CEDEAR.

export interface CedearMeta {
  symbol: string; // ticker BYMA sin sufijo (AAPL, KO, MSFT...)
  name: string;   // descripción humana
  sector: string; // tag corto para agrupar
}

export const CEDEAR_LIST: CedearMeta[] = [
  { symbol: 'AAPL', name: 'Apple', sector: 'Tech' },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Tech' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', sector: 'Tech' },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Tech' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Tech' },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Tech' },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Auto' },
  { symbol: 'NFLX', name: 'Netflix', sector: 'Media' },
  { symbol: 'DIS', name: 'Disney', sector: 'Media' },
  { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumo' },
  { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumo' },
  { symbol: 'MCD', name: "McDonald's", sector: 'Consumo' },
  { symbol: 'SBUX', name: 'Starbucks', sector: 'Consumo' },
  { symbol: 'WMT', name: 'Walmart', sector: 'Retail' },
  { symbol: 'HD', name: 'Home Depot', sector: 'Retail' },
  { symbol: 'NKE', name: 'Nike', sector: 'Consumo' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Bancos' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Bancos' },
  { symbol: 'C', name: 'Citigroup', sector: 'Bancos' },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Bancos' },
  { symbol: 'V', name: 'Visa', sector: 'Pagos' },
  { symbol: 'MA', name: 'Mastercard', sector: 'Pagos' },
  { symbol: 'PYPL', name: 'PayPal', sector: 'Pagos' },
  { symbol: 'INTC', name: 'Intel', sector: 'Tech' },
  { symbol: 'AMD', name: 'AMD', sector: 'Tech' },
  { symbol: 'IBM', name: 'IBM', sector: 'Tech' },
  { symbol: 'ORCL', name: 'Oracle', sector: 'Tech' },
  { symbol: 'CSCO', name: 'Cisco', sector: 'Tech' },
  { symbol: 'XOM', name: 'ExxonMobil', sector: 'Energía' },
  { symbol: 'CVX', name: 'Chevron', sector: 'Energía' },
  { symbol: 'BA', name: 'Boeing', sector: 'Industrial' },
  { symbol: 'GE', name: 'General Electric', sector: 'Industrial' },
  { symbol: 'PFE', name: 'Pfizer', sector: 'Salud' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Salud' },
  { symbol: 'MRK', name: 'Merck', sector: 'Salud' },
  { symbol: 'KMB', name: 'Kimberly-Clark', sector: 'Consumo' },
  { symbol: 'BRKB', name: 'Berkshire Hathaway B', sector: 'Holding' },
  { symbol: 'GLOB', name: 'Globant', sector: 'Tech' },
  { symbol: 'MELI', name: 'MercadoLibre', sector: 'Tech' },
  { symbol: 'BABA', name: 'Alibaba', sector: 'Tech' },
];

export interface CedearQuote {
  symbol: string;       // ticker base, ej. AAPL
  yahooSymbol: string;  // ej. AAPL.BA
  priceArs: number;
  changePct24h: number;
  fetchedAt: Date;
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }> | null;
    error: unknown;
  };
}

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function fetchOne(symbol: string): Promise<CedearQuote | null> {
  const yahooSymbol = `${symbol}.BA`;
  try {
    const res = await fetch(`${YAHOO_BASE}${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`, {
      cache: 'no-store',
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooChartResponse;
    const meta = data.chart.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice ?? 0);
    if (!Number.isFinite(price) || price <= 0) return null;
    const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? price);
    const changePct24h = prev > 0 ? ((price - prev) / prev) * 100 : 0;
    return {
      symbol,
      yahooSymbol,
      priceArs: price,
      changePct24h,
      fetchedAt: new Date(),
    };
  } catch (err) {
    console.warn(`[cedears] yahoo fetch failed for ${yahooSymbol}`, err);
    return null;
  }
}

export async function fetchCedearQuotes(symbols: string[] = CEDEAR_LIST.map((c) => c.symbol)): Promise<CedearQuote[]> {
  if (symbols.length === 0) return [];
  // Concurrencia limitada de a 8 para no abusar del endpoint.
  const out: CedearQuote[] = [];
  const queue = [...symbols];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const sym = queue.shift();
      if (!sym) break;
      const q = await fetchOne(sym);
      if (q) out.push(q);
    }
  });
  await Promise.all(workers);
  return out;
}
