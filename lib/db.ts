import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Indica si la app tiene una `DATABASE_URL` aparentemente válida. Esto sirve
 * para que las páginas no caigan en 500 cuando alguien deploya sin haber
 * configurado el Postgres todavía — ej. al hacer el primer deploy en Vercel.
 */
export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) return false;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  if (url.includes('user:password@')) return false; // placeholder del .env.example
  if (url.includes('stub:stub@')) return false;
  return /^postgres(ql)?:\/\//.test(url);
}

/**
 * Helper para envolver queries que pueden fallar si la DB no está disponible
 * (ej. deploy sin DATABASE_URL). Devuelve `fallback` si la query lanza, así
 * la UI puede renderizar un estado vacío en lugar de tirar 500.
 */
export async function safeDbCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDatabaseConfigured()) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.warn('[db] query failed, returning fallback', err);
    return fallback;
  }
}
