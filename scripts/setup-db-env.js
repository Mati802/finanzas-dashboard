#!/usr/bin/env node
/**
 * En Vercel, cuando integrás Neon o Vercel Postgres, las connection strings
 * se exponen como `POSTGRES_PRISMA_URL` (pooled, para queries) y
 * `POSTGRES_URL_NON_POOLING` (direct, para migraciones). Nuestro
 * `schema.prisma` lee `DATABASE_URL` / `DIRECT_URL`. Este script puentea
 * ambas convenciones: si no hay DATABASE_URL pero sí POSTGRES_PRISMA_URL,
 * lo escribe a `.env.production` para que el build (prisma + next build)
 * lo encuentre.
 *
 * Es no-op en local (donde DATABASE_URL ya viene del .env).
 */
const fs = require('node:fs');
const path = require('node:path');

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  '';

const directUrl =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  '';

if (!databaseUrl) {
  console.log('[setup-db-env] No DATABASE_URL / POSTGRES_* found — skip.');
  process.exit(0);
}

// Prisma CLI lee .env por default; Next.js también lo levanta. Lo
// escribimos crudo (sobreescribe si hay valores stub) para que tanto
// `prisma db push` como `tsx prisma/seed.ts` y `next build` resuelvan
// las URLs correctas.
const lines = [
  `DATABASE_URL=${databaseUrl}`,
  `DIRECT_URL=${directUrl || databaseUrl}`,
  '',
];
const envPath = path.resolve(__dirname, '..', '.env');
fs.writeFileSync(envPath, lines.join('\n'));
console.log(`[setup-db-env] Wrote DATABASE_URL/DIRECT_URL to .env`);
console.log(`[setup-db-env] DB host: ${databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
