import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Solo dejamos la categoría de Ingresos por defecto. Las categorías de gastos
// (fixed/variable) las carga el usuario desde Ajustes → Categorías o inline al
// agregar un gasto.
const CATEGORIES = [
  { name: 'Ingresos', kind: 'income', icon: 'trending-up', color: '#4ade80', isRecurring: false },
];

const TICKER_ITEMS = [
  { displayLabel: 'BTC/USD', sourceType: 'crypto', sourceKey: 'bitcoin', orderIndex: 0 },
  { displayLabel: 'ADA/USD', sourceType: 'crypto', sourceKey: 'cardano', orderIndex: 1 },
  { displayLabel: 'SP500', sourceType: 'index', sourceKey: '^GSPC', orderIndex: 2 },
  { displayLabel: 'OFICIAL', sourceType: 'fx_ars', sourceKey: 'oficial', orderIndex: 3 },
  { displayLabel: 'BLUE', sourceType: 'fx_ars', sourceKey: 'blue', orderIndex: 4 },
  { displayLabel: 'USDT', sourceType: 'fx_ars', sourceKey: 'usdt', orderIndex: 5 },
];

const SETTINGS = [{ key: 'default_rate_type', value: 'blue' }];

async function main() {
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }
  for (const t of TICKER_ITEMS) {
    await db.tickerItem.upsert({
      where: { id: t.orderIndex + 1 },
      update: {},
      create: t,
    });
  }
  for (const s of SETTINGS) {
    await db.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
