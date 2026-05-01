import { PrismaClient } from '@prisma/client';

/**
 * Resolución de la URL de Postgres. En Vercel-Neon las env vars vienen como
 * `POSTGRES_PRISMA_URL`/`POSTGRES_URL_NON_POOLING`; en setups manuales las
 * cargamos como `DATABASE_URL`/`DIRECT_URL`. Aceptamos ambos para no
 * depender del nombre exacto que use el provider.
 */
function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    ''
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const dbUrl = resolveDatabaseUrl();

export const db =
  globalForPrisma.prisma ??
  (dbUrl
    ? new PrismaClient({ datasources: { db: { url: dbUrl } } })
    : new PrismaClient());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Indica si la app tiene una connection string aparentemente válida.
 * Aceptamos `DATABASE_URL` y los nombres que usa la integración Vercel-Neon.
 */
export function isDatabaseConfigured(): boolean {
  const url = resolveDatabaseUrl();
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
