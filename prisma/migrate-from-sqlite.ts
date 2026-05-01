/**
 * Migración one-shot: lee la DB local de SQLite (`prisma/prisma/finanzas.db`)
 * y persiste todas las filas en la Postgres apuntada por DATABASE_URL.
 *
 * Uso:
 *   1. Asegurate de tener DATABASE_URL/DIRECT_URL apuntando a Postgres en .env
 *   2. Que la base destino tenga las tablas creadas: `npm run db:push`
 *   3. Corré: `npx tsx prisma/migrate-from-sqlite.ts`
 *
 * Es idempotente — usa upsert por id donde puede.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const SQLITE_PATH = path.resolve(__dirname, 'prisma/finanzas.db');
const db = new PrismaClient();

function readTable<T = Record<string, unknown>>(table: string): T[] {
  if (!existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite DB not found at ${SQLITE_PATH}`);
  }
  // sqlite3 devuelve JSON tipo `[{col: val, ...}, ...]` con `.mode json`.
  // Para tablas reservadas como "Transaction" hay que comillarlo.
  const quoted = `"${table.replace(/"/g, '""')}"`;
  const cmd = `sqlite3 ${JSON.stringify(SQLITE_PATH)} -json "SELECT * FROM ${quoted};"`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }).trim();
  if (!out) return [];
  return JSON.parse(out) as T[];
}

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function migrateCategories() {
  const rows = readTable<{
    id: number;
    name: string;
    kind: string;
    icon: string;
    color: string;
    isRecurring: number;
  }>('Category');
  for (const r of rows) {
    await db.category.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        kind: r.kind,
        icon: r.icon,
        color: r.color,
        isRecurring: !!r.isRecurring,
      },
      create: {
        id: r.id,
        name: r.name,
        kind: r.kind,
        icon: r.icon,
        color: r.color,
        isRecurring: !!r.isRecurring,
      },
    });
  }
  console.log(`  Category: ${rows.length}`);
}

async function migrateAssets() {
  const rows = readTable<{
    id: number;
    name: string;
    type: string;
    kind: string;
    quantity: string;
    ticker: string | null;
    priceSource: string | null;
    manualValue: string | null;
    currency: string;
    createdAt: string | number;
    updatedAt: string | number;
  }>('Asset');
  for (const r of rows) {
    await db.asset.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        type: r.type,
        kind: r.kind ?? 'wallet',
        quantity: r.quantity,
        ticker: r.ticker,
        priceSource: r.priceSource,
        manualValue: r.manualValue,
        currency: r.currency,
      },
      create: {
        id: r.id,
        name: r.name,
        type: r.type,
        kind: r.kind ?? 'wallet',
        quantity: r.quantity,
        ticker: r.ticker,
        priceSource: r.priceSource,
        manualValue: r.manualValue,
        currency: r.currency,
        createdAt: toDate(r.createdAt) ?? new Date(),
        updatedAt: toDate(r.updatedAt) ?? new Date(),
      },
    });
  }
  console.log(`  Asset: ${rows.length}`);
}

async function migrateTransactions() {
  const rows = readTable<{
    id: number;
    date: string | number;
    type: string;
    amount: string;
    currency: string;
    categoryId: number;
    note: string | null;
    createdAt: string | number;
  }>('Transaction');
  for (const r of rows) {
    const d = toDate(r.date);
    if (!d) continue;
    await db.transaction.upsert({
      where: { id: r.id },
      update: {
        date: d,
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        categoryId: r.categoryId,
        note: r.note,
      },
      create: {
        id: r.id,
        date: d,
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        categoryId: r.categoryId,
        note: r.note,
        createdAt: toDate(r.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`  Transaction: ${rows.length}`);
}

async function migrateLiabilities() {
  const rows = readTable<{
    id: number;
    name: string;
    amount: string;
    currency: string;
    dueDate: string | number | null;
    note: string | null;
  }>('Liability');
  for (const r of rows) {
    await db.liability.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        amount: r.amount,
        currency: r.currency,
        dueDate: toDate(r.dueDate),
        note: r.note,
      },
      create: {
        id: r.id,
        name: r.name,
        amount: r.amount,
        currency: r.currency,
        dueDate: toDate(r.dueDate),
        note: r.note,
      },
    });
  }
  console.log(`  Liability: ${rows.length}`);
}

async function migrateSettings() {
  const rows = readTable<{ key: string; value: string }>('Setting');
  for (const r of rows) {
    await db.setting.upsert({
      where: { key: r.key },
      update: { value: r.value },
      create: { key: r.key, value: r.value },
    });
  }
  console.log(`  Setting: ${rows.length}`);
}

async function migrateTickerItems() {
  const rows = readTable<{
    id: number;
    displayLabel: string;
    sourceType: string;
    sourceKey: string;
    orderIndex: number;
    isVisible: number;
  }>('TickerItem');
  for (const r of rows) {
    await db.tickerItem.upsert({
      where: { id: r.id },
      update: {
        displayLabel: r.displayLabel,
        sourceType: r.sourceType,
        sourceKey: r.sourceKey,
        orderIndex: r.orderIndex,
        isVisible: !!r.isVisible,
      },
      create: {
        id: r.id,
        displayLabel: r.displayLabel,
        sourceType: r.sourceType,
        sourceKey: r.sourceKey,
        orderIndex: r.orderIndex,
        isVisible: !!r.isVisible,
      },
    });
  }
  console.log(`  TickerItem: ${rows.length}`);
}

async function migrateSnapshots() {
  const rows = readTable<{
    id: number;
    date: string | number;
    assetsUsd: string;
    liabilitiesUsd: string;
    netWorthUsd: string;
    exchangeRateUsed: string;
    createdAt: string | number;
  }>('Snapshot');
  for (const r of rows) {
    const d = toDate(r.date);
    if (!d) continue;
    await db.snapshot.upsert({
      where: { date: d },
      update: {
        assetsUsd: r.assetsUsd,
        liabilitiesUsd: r.liabilitiesUsd,
        netWorthUsd: r.netWorthUsd,
        exchangeRateUsed: r.exchangeRateUsed,
      },
      create: {
        date: d,
        assetsUsd: r.assetsUsd,
        liabilitiesUsd: r.liabilitiesUsd,
        netWorthUsd: r.netWorthUsd,
        exchangeRateUsed: r.exchangeRateUsed,
        createdAt: toDate(r.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`  Snapshot: ${rows.length}`);
}

async function resetSequences() {
  // Postgres mantiene secuencias autoincrement separadas. Después de insertar
  // filas con id explícito hay que avanzar la secuencia para que los próximos
  // INSERT (sin id) no choquen.
  const tables = ['Category', 'Asset', 'Transaction', 'Liability', 'TickerItem', 'Snapshot'];
  for (const t of tables) {
    try {
      await db.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1));`
      );
    } catch (err) {
      console.warn(`  (no pude resetear secuencia de ${t}:`, err, ')');
    }
  }
}

async function main() {
  console.log('Migrando datos de SQLite → Postgres…');
  console.log(`  source: ${SQLITE_PATH}`);
  console.log(`  target: ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@')}`);
  console.log('');

  // Orden: padres antes que hijos (FKs).
  await migrateCategories();
  await migrateAssets();
  await migrateTransactions();
  await migrateLiabilities();
  await migrateSettings();
  await migrateTickerItems();
  await migrateSnapshots();
  await resetSequences();

  console.log('\n✅ Migración completa.');
}

main()
  .catch((e) => {
    console.error('❌ Migración falló:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
