import type { Currency } from './types';

/** Formatea un número como USD con separadores de miles y 2 decimales. */
export function formatUSD(amount: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea precios de cripto, preservando cifras significativas en activos sub-$1.
 * - v ≥ 1         → 2 decimales (como formatUSD)
 * - 0 < v < 1     → 4 cifras significativas (ej. ADA 0.2567, SHIB 0.00002341)
 * - v ≤ 0         → "$0.00"
 */
export function formatCryptoPrice(amount: number): string {
  const abs = Math.abs(amount);
  if (!Number.isFinite(amount) || abs === 0) return '$0.00';
  if (abs >= 1) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  // Sub-$1: usamos cifras significativas (no decimales fijos).
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumSignificantDigits: 4,
    minimumSignificantDigits: 4,
  }).format(amount);
}

/** Formatea un número como ARS. */
export function formatARS(amount: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(amount) >= 1000) {
    return (
      '$' +
      new Intl.NumberFormat('es-AR', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount)
    );
  }
  return (
    '$' +
    new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  );
}

/** Formatea un monto según la moneda. */
export function formatMoney(amount: number, currency: Currency, opts?: { compact?: boolean }): string {
  return currency === 'USD' ? formatUSD(amount, opts) : formatARS(amount, opts);
}

/**
 * Formateador compacto para ejes de gráficos.
 * - |v| < 1000   → $500, $100, $0
 * - |v| < 1M     → $1.5k, $12.3k (un decimal)
 * - |v| ≥ 1M     → $1.2M, $3.4M
 * Evita mostrar "$0k" para valores pequeños que no son cero.
 */
export function formatCompactUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs < 1000) return `${sign}$${Math.round(abs)}`;
  if (abs < 1_000_000) {
    const k = abs / 1000;
    // Si es entero (ej. 2000 → 2k) no mostramos ".0"; si no, un decimal.
    const str = Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1);
    return `${sign}$${str}k`;
  }
  const m = abs / 1_000_000;
  const str = Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1);
  return `${sign}$${str}M`;
}

/** Formatea un porcentaje con signo. */
export function formatPct(pct: number, decimals = 2): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

/** Formatea un número simple con separadores. */
export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Formatea fecha yyyy-mm-dd a "21 abr". */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(d);
}

/** Formatea fecha como "21 abril 2026". */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Nombre del mes. */
export function formatMonthName(month: number, year?: number): string {
  const d = new Date(year ?? 2026, month - 1, 1);
  return new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(d);
}

/** Convierte Decimal (o cualquier cosa toString-able) a number. */
export function toNumber(v: { toString: () => string } | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}
