// Shared domain types — kept in sync with Prisma schema (which uses strings on SQLite).

export type TransactionType = 'income' | 'expense';
export type Currency = 'USD' | 'ARS';
export type CategoryKind = 'fixed' | 'variable' | 'income';
export type AssetType = 'cash_usd' | 'cash_ars' | 'stock' | 'crypto' | 'property' | 'other';
export type AssetKind = 'wallet' | 'investment' | 'object';
export const ASSET_KINDS: AssetKind[] = ['wallet', 'investment', 'object'];
export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  wallet: 'Cuenta / Wallet',
  investment: 'Inversión',
  object: 'Objeto / Bien',
};
// 'yahoo' y 'coingecko' se mantienen por compat con filas existentes en DB,
// pero el código ya no los usa. Para nuevos activos siempre se graba
// 'coinmarketcap' (si hay ticker) o 'manual' (si no).
export type PriceSource = 'manual' | 'coinmarketcap' | 'yahoo' | 'coingecko';
export type RateType = 'oficial' | 'blue' | 'mep' | 'ccl' | 'usdt';
export type TickerSourceType = 'fx_ars' | 'fx_usd' | 'crypto' | 'stock' | 'index';

export const CURRENCIES: Currency[] = ['USD', 'ARS'];
export const RATE_TYPES: RateType[] = ['oficial', 'blue', 'mep', 'ccl', 'usdt'];
export const RATE_LABELS: Record<RateType, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  mep: 'MEP',
  ccl: 'CCL',
  usdt: 'USDT',
};
export const ASSET_TYPES: AssetType[] = ['cash_usd', 'cash_ars', 'stock', 'crypto', 'property', 'other'];
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  cash_usd: 'Efectivo USD',
  cash_ars: 'Efectivo ARS',
  stock: 'Acción',
  crypto: 'Cripto',
  property: 'Propiedad',
  other: 'Otro',
};
