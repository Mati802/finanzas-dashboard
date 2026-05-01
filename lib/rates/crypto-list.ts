// Cripto populares con su mapping a CoinGecko (id) y CoinMarketCap (symbol).
// CoinGecko no requiere API key, así que lo usamos como fallback cuando
// COINMARKETCAP_API_KEY no está configurada.

export interface CryptoMeta {
  symbol: string;       // ticker estándar (BTC, ETH, USDT...)
  name: string;         // nombre humano (Bitcoin, Ethereum...)
  coingeckoId: string;  // id usado por la API de CoinGecko
}

export const CRYPTO_LIST: CryptoMeta[] = [
  { symbol: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum' },
  { symbol: 'USDT', name: 'Tether (USDT)', coingeckoId: 'tether' },
  { symbol: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin' },
  { symbol: 'BNB', name: 'BNB', coingeckoId: 'binancecoin' },
  { symbol: 'SOL', name: 'Solana', coingeckoId: 'solana' },
  { symbol: 'XRP', name: 'XRP', coingeckoId: 'ripple' },
  { symbol: 'ADA', name: 'Cardano', coingeckoId: 'cardano' },
  { symbol: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin' },
  { symbol: 'TRX', name: 'TRON', coingeckoId: 'tron' },
  { symbol: 'AVAX', name: 'Avalanche', coingeckoId: 'avalanche-2' },
  { symbol: 'DOT', name: 'Polkadot', coingeckoId: 'polkadot' },
  { symbol: 'MATIC', name: 'Polygon', coingeckoId: 'matic-network' },
  { symbol: 'LINK', name: 'Chainlink', coingeckoId: 'chainlink' },
  { symbol: 'LTC', name: 'Litecoin', coingeckoId: 'litecoin' },
  { symbol: 'BCH', name: 'Bitcoin Cash', coingeckoId: 'bitcoin-cash' },
  { symbol: 'XLM', name: 'Stellar', coingeckoId: 'stellar' },
  { symbol: 'ATOM', name: 'Cosmos', coingeckoId: 'cosmos' },
  { symbol: 'ETC', name: 'Ethereum Classic', coingeckoId: 'ethereum-classic' },
  { symbol: 'NEAR', name: 'NEAR Protocol', coingeckoId: 'near' },
  { symbol: 'UNI', name: 'Uniswap', coingeckoId: 'uniswap' },
  { symbol: 'APT', name: 'Aptos', coingeckoId: 'aptos' },
  { symbol: 'ARB', name: 'Arbitrum', coingeckoId: 'arbitrum' },
  { symbol: 'OP', name: 'Optimism', coingeckoId: 'optimism' },
  { symbol: 'PEPE', name: 'Pepe', coingeckoId: 'pepe' },
  { symbol: 'SHIB', name: 'Shiba Inu', coingeckoId: 'shiba-inu' },
  { symbol: 'DAI', name: 'Dai', coingeckoId: 'dai' },
  { symbol: 'TON', name: 'Toncoin', coingeckoId: 'the-open-network' },
];

const SYMBOL_TO_ID = new Map(
  CRYPTO_LIST.map((c) => [c.symbol.toUpperCase(), c.coingeckoId])
);

export function symbolToCoingeckoId(symbol: string): string | null {
  return SYMBOL_TO_ID.get(symbol.toUpperCase()) ?? null;
}
