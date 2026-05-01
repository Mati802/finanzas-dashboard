import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de diagnóstico — muestra qué env vars relacionadas con la DB
 * están presentes (sin revelar valores) y, si la DB conecta, los counts
 * de las tablas principales.
 */
export async function GET() {
  const envFlags = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    NODE_ENV: process.env.NODE_ENV ?? null,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  };

  const configured = isDatabaseConfigured();
  if (!configured) {
    return NextResponse.json({ ok: false, configured: false, env: envFlags });
  }

  try {
    const [categories, assets, transactions, liabilities, settings, ticker] = await Promise.all([
      db.category.count(),
      db.asset.count(),
      db.transaction.count(),
      db.liability.count(),
      db.setting.count(),
      db.tickerItem.count(),
    ]);
    return NextResponse.json({
      ok: true,
      configured: true,
      env: envFlags,
      counts: { categories, assets, transactions, liabilities, settings, ticker },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      configured: true,
      env: envFlags,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
