import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

type AssetType = 'cash_usd' | 'cash_ars' | 'crypto';
type Currency = 'USD' | 'ARS';

interface AccountSeed {
  name: string;
  type: AssetType;
  currency: Currency;
  ticker?: string;
}

const ACCOUNTS: AccountSeed[] = [
  { name: 'Santander Río — USD', type: 'cash_usd', currency: 'USD' },
  { name: 'Santander Río — ARS', type: 'cash_ars', currency: 'ARS' },
  { name: 'Dolar App (USDT)', type: 'crypto', currency: 'USD', ticker: 'USDT' },
  { name: 'Mercury (USDT)', type: 'crypto', currency: 'USD', ticker: 'USDT' },
  { name: 'Galicia', type: 'cash_ars', currency: 'ARS' },
  { name: 'Cypher Wallet (USDT)', type: 'crypto', currency: 'USD', ticker: 'USDT' },
  { name: 'OKX — USDT', type: 'crypto', currency: 'USD', ticker: 'USDT' },
  { name: 'OKX — BTC', type: 'crypto', currency: 'USD', ticker: 'BTC' },
  { name: 'OKX — ETH', type: 'crypto', currency: 'USD', ticker: 'ETH' },
  { name: 'Banco Provincia', type: 'cash_ars', currency: 'ARS' },
  { name: 'Prex', type: 'cash_ars', currency: 'ARS' },
  { name: 'Brubank — ARS', type: 'cash_ars', currency: 'ARS' },
  { name: 'Brubank — USD', type: 'cash_usd', currency: 'USD' },
  { name: 'Astropay', type: 'cash_usd', currency: 'USD' },
  { name: 'Galicia Empresa', type: 'cash_ars', currency: 'ARS' },
  { name: 'Dólar físico', type: 'cash_usd', currency: 'USD' },
  { name: 'Pesos físico', type: 'cash_ars', currency: 'ARS' },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const a of ACCOUNTS) {
    const exists = await db.asset.findFirst({ where: { name: a.name } });
    if (exists) {
      skipped++;
      continue;
    }
    await db.asset.create({
      data: {
        name: a.name,
        type: a.type,
        kind: 'wallet',
        quantity: 0,
        ticker: a.ticker ?? null,
        priceSource: a.ticker ? 'coinmarketcap' : 'manual',
        manualValue: a.ticker ? null : 0,
        currency: a.currency,
      },
    });
    created++;
  }
  console.log(`Accounts seed complete — created ${created}, skipped ${skipped} (already existed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
