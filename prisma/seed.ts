import { PrismaClient } from '@prisma/client';
import {
  CATEGORIES,
  ASSETS,
  TRANSACTIONS,
  LIABILITIES,
  SETTINGS,
  TICKER_ITEMS,
} from './seed-data';

const db = new PrismaClient();

function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) return false;
  if (url.includes('user:password@')) return false;
  if (url.includes('stub:stub@')) return false;
  return /^postgres(ql)?:\/\//.test(url);
}

async function main() {
  if (!isDatabaseConfigured()) {
    console.log('Skipping seed — DATABASE_URL no configurada (deploy sin DB todavía).');
    return;
  }

  // Upserts idempotentes: cada fila se inserta o actualiza por id/key.
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { id: c.id },
      update: { name: c.name, kind: c.kind, icon: c.icon, color: c.color, isRecurring: c.isRecurring },
      create: c,
    });
  }
  console.log(`  Category: ${CATEGORIES.length}`);

  for (const a of ASSETS) {
    await db.asset.upsert({
      where: { id: a.id },
      update: {
        name: a.name,
        type: a.type,
        kind: a.kind,
        quantity: a.quantity,
        ticker: a.ticker,
        priceSource: a.priceSource,
        manualValue: a.manualValue,
        currency: a.currency,
      },
      create: a,
    });
  }
  console.log(`  Asset: ${ASSETS.length}`);

  for (const t of TRANSACTIONS) {
    await db.transaction.upsert({
      where: { id: t.id },
      update: {
        date: new Date(t.date),
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        categoryId: t.categoryId,
        note: t.note,
      },
      create: { ...t, date: new Date(t.date) },
    });
  }
  console.log(`  Transaction: ${TRANSACTIONS.length}`);

  for (const l of LIABILITIES) {
    await db.liability.upsert({
      where: { id: l.id },
      update: {
        name: l.name,
        amount: l.amount,
        currency: l.currency,
        dueDate: l.dueDate ? new Date(l.dueDate) : null,
        note: l.note,
      },
      create: { ...l, dueDate: l.dueDate ? new Date(l.dueDate) : null },
    });
  }
  console.log(`  Liability: ${LIABILITIES.length}`);

  for (const s of SETTINGS) {
    await db.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`  Setting: ${SETTINGS.length}`);

  for (const ti of TICKER_ITEMS) {
    await db.tickerItem.upsert({
      where: { id: ti.id },
      update: {
        displayLabel: ti.displayLabel,
        sourceType: ti.sourceType,
        sourceKey: ti.sourceKey,
        orderIndex: ti.orderIndex,
        isVisible: ti.isVisible,
      },
      create: ti,
    });
  }
  console.log(`  TickerItem: ${TICKER_ITEMS.length}`);

  // Avanzamos las secuencias de Postgres para que los próximos INSERT sin id
  // explícito no choquen con los ids que acabamos de fijar.
  const tables = ['Category', 'Asset', 'Transaction', 'Liability', 'TickerItem', 'Snapshot'];
  for (const t of tables) {
    try {
      await db.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1));`
      );
    } catch {
      /* secuencia no existe (provider distinto), ignoramos */
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
