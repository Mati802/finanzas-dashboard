// Datos personales del usuario, congelados desde la DB local de SQLite. El
// seed (`prisma/seed.ts`) hace upsert de cada fila en Postgres en cada deploy
// — es idempotente, así que no duplica datos. Si en el futuro querés
// actualizar estos snapshots, regenerá este archivo desde la DB de prod.

export interface CategorySeed {
  id: number;
  name: string;
  kind: string;
  icon: string;
  color: string;
  isRecurring: boolean;
}

export interface AssetSeed {
  id: number;
  name: string;
  type: string;
  kind: string;
  quantity: number;
  ticker: string | null;
  priceSource: string | null;
  manualValue: number | null;
  currency: string;
}

export interface TransactionSeed {
  id: number;
  date: string; // ISO
  type: string;
  amount: number;
  currency: string;
  categoryId: number;
  note: string | null;
}

export interface LiabilitySeed {
  id: number;
  name: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  note: string | null;
}

export interface SettingSeed {
  key: string;
  value: string;
}

export interface TickerItemSeed {
  id: number;
  displayLabel: string;
  sourceType: string;
  sourceKey: string;
  orderIndex: number;
  isVisible: boolean;
}

export const CATEGORIES: CategorySeed[] = [
  { id: 1, name: 'Ingresos', kind: 'income', icon: 'trending-up', color: '#4ade80', isRecurring: false },
  { id: 2, name: 'ARCA', kind: 'fixed', icon: 'tag', color: '#8b5cf6', isRecurring: false },
  { id: 3, name: 'AUTO', kind: 'fixed', icon: 'tag', color: '#8b5cf6', isRecurring: false },
];

export const ASSETS: AssetSeed[] = [
  { id: 1, name: 'Santander Río — USD', type: 'cash_usd', kind: 'wallet', quantity: 6303, ticker: null, priceSource: 'manual', manualValue: 6303, currency: 'USD' },
  { id: 2, name: 'Santander Río — ARS', type: 'cash_ars', kind: 'wallet', quantity: 232232, ticker: null, priceSource: 'manual', manualValue: 232232, currency: 'ARS' },
  { id: 3, name: 'Dolar App (USDT)', type: 'crypto', kind: 'wallet', quantity: 2, ticker: 'USDT', priceSource: 'coinmarketcap', manualValue: null, currency: 'USD' },
  { id: 4, name: 'Mercury (USDT)', type: 'crypto', kind: 'wallet', quantity: 2500, ticker: 'USDT', priceSource: 'coinmarketcap', manualValue: null, currency: 'USD' },
  { id: 5, name: 'Galicia', type: 'cash_ars', kind: 'wallet', quantity: 0, ticker: null, priceSource: 'manual', manualValue: 0, currency: 'ARS' },
  { id: 6, name: 'Cypher Wallet (USDT)', type: 'crypto', kind: 'wallet', quantity: 5, ticker: 'USDT', priceSource: 'coinmarketcap', manualValue: null, currency: 'USD' },
  { id: 7, name: 'OKX — USDT', type: 'crypto', kind: 'wallet', quantity: 13650, ticker: 'USDT', priceSource: 'coinmarketcap', manualValue: null, currency: 'USD' },
  { id: 10, name: 'Banco Provincia', type: 'cash_ars', kind: 'wallet', quantity: 0, ticker: null, priceSource: 'manual', manualValue: 7088, currency: 'ARS' },
  { id: 11, name: 'Prex', type: 'cash_ars', kind: 'wallet', quantity: 57028, ticker: null, priceSource: 'manual', manualValue: 57028, currency: 'ARS' },
  { id: 12, name: 'Brubank — ARS', type: 'cash_ars', kind: 'wallet', quantity: 0, ticker: null, priceSource: 'manual', manualValue: 151879, currency: 'ARS' },
  { id: 13, name: 'Brubank — USD', type: 'cash_usd', kind: 'wallet', quantity: 9510, ticker: null, priceSource: 'manual', manualValue: 9510, currency: 'USD' },
  { id: 14, name: 'Astropay', type: 'cash_usd', kind: 'wallet', quantity: 78.35, ticker: null, priceSource: 'manual', manualValue: 78.35, currency: 'USD' },
  { id: 15, name: 'Galicia Empresa', type: 'cash_ars', kind: 'wallet', quantity: 68928, ticker: null, priceSource: 'manual', manualValue: 68928, currency: 'ARS' },
  { id: 16, name: 'Dólar físico', type: 'cash_usd', kind: 'wallet', quantity: 800, ticker: null, priceSource: 'manual', manualValue: 800, currency: 'USD' },
  { id: 17, name: 'Pesos físico', type: 'cash_ars', kind: 'wallet', quantity: 246200, ticker: null, priceSource: 'manual', manualValue: 246200, currency: 'ARS' },
  { id: 18, name: 'NVIDIA (CEDEAR NVDA)', type: 'stock', kind: 'investment', quantity: 249, ticker: 'NVDA', priceSource: 'coinmarketcap', manualValue: null, currency: 'ARS' },
  { id: 19, name: 'Bitcoin', type: 'crypto', kind: 'investment', quantity: 0.06416998, ticker: 'BTC', priceSource: 'coinmarketcap', manualValue: null, currency: 'USD' },
  { id: 20, name: 'Ethereum', type: 'crypto', kind: 'investment', quantity: 0.77186025, ticker: 'ETH', priceSource: 'coinmarketcap', manualValue: null, currency: 'USD' },
  { id: 21, name: 'PAPA USD', type: 'cash_usd', kind: 'wallet', quantity: 2500, ticker: null, priceSource: 'manual', manualValue: 2500, currency: 'USD' },
  { id: 22, name: 'PAPA PESOS', type: 'cash_ars', kind: 'wallet', quantity: 5800000, ticker: null, priceSource: 'manual', manualValue: 5800000, currency: 'ARS' },
  { id: 23, name: 'MAMA USD', type: 'cash_usd', kind: 'wallet', quantity: 4100, ticker: null, priceSource: 'manual', manualValue: 4100, currency: 'USD' },
  { id: 24, name: 'PAPA USDT', type: 'crypto', kind: 'wallet', quantity: 2697000, ticker: 'USDT', priceSource: 'coinmarketcap', manualValue: null, currency: 'ARS' },
  { id: 25, name: 'MUSTANG GT', type: 'property', kind: 'object', quantity: 1, ticker: null, priceSource: 'manual', manualValue: 86000, currency: 'USD' },
];

export const TRANSACTIONS: TransactionSeed[] = [
  { id: 1, date: '2026-04-30T00:00:00.000Z', type: 'expense', amount: 66390, currency: 'ARS', categoryId: 2, note: 'Autonomo' },
  { id: 2, date: '2026-04-30T00:00:00.000Z', type: 'expense', amount: 382518, currency: 'ARS', categoryId: 2, note: 'Seguro Mustang' },
  { id: 3, date: '2026-04-30T00:00:00.000Z', type: 'expense', amount: 132778, currency: 'ARS', categoryId: 2, note: 'Autonomo Papa' },
  { id: 4, date: '2026-04-30T00:00:00.000Z', type: 'expense', amount: 235000, currency: 'ARS', categoryId: 2, note: 'Contador' },
];

export const LIABILITIES: LiabilitySeed[] = [
  { id: 1, name: 'STOCK RANCHO DOBLE', amount: 6520000, currency: 'ARS', dueDate: null, note: null },
];

export const SETTINGS: SettingSeed[] = [
  { key: 'default_rate_type', value: 'blue' },
];

export const TICKER_ITEMS: TickerItemSeed[] = [
  { id: 1, displayLabel: 'BTC/USD', sourceType: 'crypto', sourceKey: 'bitcoin', orderIndex: 0, isVisible: true },
  { id: 2, displayLabel: 'ADA/USD', sourceType: 'crypto', sourceKey: 'cardano', orderIndex: 1, isVisible: true },
  { id: 3, displayLabel: 'SP500', sourceType: 'index', sourceKey: '^GSPC', orderIndex: 2, isVisible: true },
  { id: 4, displayLabel: 'OFICIAL', sourceType: 'fx_ars', sourceKey: 'oficial', orderIndex: 3, isVisible: true },
  { id: 5, displayLabel: 'BLUE', sourceType: 'fx_ars', sourceKey: 'blue', orderIndex: 4, isVisible: true },
  { id: 6, displayLabel: 'USDT', sourceType: 'fx_ars', sourceKey: 'usdt', orderIndex: 5, isVisible: true },
];
