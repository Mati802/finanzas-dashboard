# Personal Finance App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only Next.js web application that replaces the user's personal-finance Excel with a premium dark UI, auto-updating exchange rates, portfolio tracking, and Excel import.

**Architecture:** Single Next.js 15 app (App Router) with TypeScript, Tailwind, shadcn/ui and Lucide icons. SQLite via Prisma ORM for local storage. Rates/prices fetched from dolarapi, CoinGecko, Yahoo Finance, and Frankfurter through internal API routes with TanStack Query caching on the client. Charts rendered with Recharts.

**Tech Stack:** Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · Lucide React · Recharts · Prisma + SQLite · TanStack Query · `xlsx` (SheetJS) · Vitest (unit tests) · Zod (validation)

**Reference spec:** `docs/superpowers/specs/2026-04-21-personal-finance-app-design.md`

---

## File Structure

```
finanzas/
├── app/
│   ├── layout.tsx                       # Root layout w/ sidebar + ticker
│   ├── globals.css                      # Tailwind base + design tokens
│   ├── page.tsx                         # /  (Dashboard)
│   ├── transacciones/page.tsx
│   ├── ingresos/page.tsx
│   ├── gastos/page.tsx
│   ├── inversiones/page.tsx
│   ├── patrimonio/page.tsx
│   ├── reportes/page.tsx
│   ├── ajustes/page.tsx
│   ├── actions/                         # Server Actions
│   │   ├── transactions.ts
│   │   ├── categories.ts
│   │   ├── assets.ts
│   │   ├── liabilities.ts
│   │   ├── ticker-items.ts
│   │   ├── settings.ts
│   │   ├── import.ts
│   │   └── backup.ts
│   └── api/
│       ├── rates/route.ts
│       ├── rates/history/route.ts
│       ├── rates/refresh/route.ts
│       └── market/[ticker]/route.ts
├── components/
│   ├── layout/Sidebar.tsx
│   ├── layout/Ticker.tsx
│   ├── dashboard/KPICard.tsx
│   ├── dashboard/AreaChart.tsx
│   ├── dashboard/ComparisonChart.tsx
│   ├── dashboard/CashflowChart.tsx
│   ├── dashboard/CategoryBreakdown.tsx
│   ├── dashboard/AssetDonut.tsx
│   ├── forms/TransactionForm.tsx
│   ├── forms/AssetForm.tsx
│   ├── forms/LiabilityForm.tsx
│   └── ui/                               # shadcn components
├── lib/
│   ├── db.ts                             # Prisma client singleton
│   ├── format.ts                         # Currency/number formatters
│   ├── convert.ts                        # USD↔ARS conversion helpers
│   ├── rates/
│   │   ├── dolarapi.ts
│   │   ├── coingecko.ts
│   │   ├── yahoo.ts
│   │   ├── frankfurter.ts
│   │   └── index.ts                      # Unified fetcher
│   ├── import-excel.ts                   # Excel parser
│   ├── snapshot.ts                       # Daily net-worth snapshot generator
│   └── queries/                          # Query helpers (server-only)
│       ├── transactions.ts
│       ├── dashboard.ts
│       └── portfolio.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                           # Default categories + ticker items
├── tests/
│   ├── rates/dolarapi.test.ts
│   ├── rates/coingecko.test.ts
│   ├── rates/yahoo.test.ts
│   ├── rates/frankfurter.test.ts
│   ├── convert.test.ts
│   ├── import-excel.test.ts
│   └── fixtures/                         # Sample Excel + JSON fixtures
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── .gitignore
└── finanzas.db                           # SQLite (gitignored)
```

---

## Phase 0 — Project scaffolding

### Task 0.1: Initialize Next.js project and dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Bootstrap Next.js**

Run (answer all defaults — TypeScript yes, ESLint yes, Tailwind yes, App Router yes, src/ no, import alias `@/*` yes):

```bash
npx create-next-app@latest finanzas --typescript --tailwind --eslint --app --import-alias "@/*" --no-src-dir --yes
cd finanzas
```

Expected: directory `finanzas/` created with boilerplate.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install prisma @prisma/client @tanstack/react-query zod lucide-react recharts xlsx decimal.js date-fns
npm install -D vitest @vitest/ui @types/node tsx
```

- [ ] **Step 3: Install shadcn/ui base**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input label select dialog dropdown-menu table tabs toast form textarea
```

Expected: `components/ui/` populated.

- [ ] **Step 4: Update `.gitignore`**

Replace `.gitignore` with:

```gitignore
node_modules/
.next/
out/
build/
dist/
.DS_Store
*.log
.env*
!.env.example
finanzas.db
finanzas.db-journal
/prisma/migrations/dev/
.vitest-cache/
```

- [ ] **Step 5: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Next.js starts on `http://localhost:3000`. Ctrl+C to stop.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js app with Tailwind, shadcn/ui, Prisma, Recharts"
```

---

### Task 0.2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 2: Create `tests/setup.ts`**

```typescript
import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.TZ = 'America/Argentina/Buenos_Aires';
});
```

- [ ] **Step 3: Add scripts to `package.json`**

Inside `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"db:push": "prisma db push",
"db:migrate": "prisma migrate dev",
"db:seed": "tsx prisma/seed.ts",
"db:studio": "prisma studio"
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: "No test files found" exit 0. (Vitest works.)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json
git commit -m "chore: configure Vitest"
```

---

## Phase 1 — Database schema and seed

### Task 1.1: Prisma schema with all 8 tables

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

Expected: creates `prisma/schema.prisma` and `.env` with `DATABASE_URL="file:./dev.db"`.

- [ ] **Step 2: Update `.env` to point to project root**

Replace `.env`:
```
DATABASE_URL="file:../finanzas.db"
```

- [ ] **Step 3: Write full schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum TransactionType {
  income
  expense
}

enum Currency {
  USD
  ARS
}

enum CategoryKind {
  fixed
  variable
  income
}

enum AssetType {
  cash_usd
  cash_ars
  stock
  crypto
  property
  other
}

enum PriceSource {
  manual
  yahoo
  coingecko
}

enum RateType {
  oficial
  blue
  mep
  ccl
  usdt
}

enum TickerSourceType {
  fx_ars
  fx_usd
  crypto
  stock
  index
}

model Transaction {
  id         Int             @id @default(autoincrement())
  date       DateTime
  type       TransactionType
  amount     Decimal
  currency   Currency
  categoryId Int
  category   Category        @relation(fields: [categoryId], references: [id])
  note       String?
  createdAt  DateTime        @default(now())

  @@index([date])
  @@index([categoryId])
  @@index([type])
}

model Category {
  id           Int            @id @default(autoincrement())
  name         String         @unique
  kind         CategoryKind
  icon         String
  color        String
  isRecurring  Boolean        @default(false)
  transactions Transaction[]
}

model Asset {
  id           Int         @id @default(autoincrement())
  name         String
  type         AssetType
  quantity     Decimal
  ticker       String?
  priceSource  PriceSource?
  manualValue  Decimal?
  currency     Currency
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model Liability {
  id       Int       @id @default(autoincrement())
  name     String
  amount   Decimal
  currency Currency
  dueDate  DateTime?
  note     String?
}

model ExchangeRate {
  id         Int       @id @default(autoincrement())
  type       RateType
  buyPrice   Decimal
  sellPrice  Decimal
  fetchedAt  DateTime  @default(now())

  @@index([type, fetchedAt])
}

model MarketPrice {
  id            Int      @id @default(autoincrement())
  ticker        String
  price         Decimal
  changePct24h  Decimal
  fetchedAt     DateTime @default(now())

  @@index([ticker, fetchedAt])
}

model Snapshot {
  id                Int      @id @default(autoincrement())
  date              DateTime @unique
  assetsUsd         Decimal
  liabilitiesUsd    Decimal
  netWorthUsd       Decimal
  exchangeRateUsed  Decimal
  createdAt         DateTime @default(now())
}

model TickerItem {
  id           Int              @id @default(autoincrement())
  displayLabel String
  sourceType   TickerSourceType
  sourceKey    String
  orderIndex   Int
  isVisible    Boolean          @default(true)

  @@index([orderIndex])
}

model Setting {
  key   String @id
  value String
}
```

- [ ] **Step 4: Push schema to DB**

```bash
npx prisma db push
```

Expected: `finanzas.db` created at project root.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma .env
git commit -m "feat(db): add Prisma schema with 8 tables"
```

---

### Task 1.2: Prisma client singleton and seed script

**Files:**
- Create: `lib/db.ts`, `prisma/seed.ts`

- [ ] **Step 1: Create `lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 2: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const CATEGORIES = [
  { name: 'Ingresos', kind: 'income', icon: 'trending-up', color: '#4ade80', isRecurring: false },
  { name: 'Movistar', kind: 'fixed', icon: 'signal', color: '#8b5cf6', isRecurring: true },
  { name: 'Claude', kind: 'fixed', icon: 'brain-circuit', color: '#a78bfa', isRecurring: true },
  { name: 'Adobe', kind: 'fixed', icon: 'palette', color: '#fb923c', isRecurring: true },
  { name: 'Google', kind: 'fixed', icon: 'chrome', color: '#4ade80', isRecurring: true },
  { name: 'Apple', kind: 'fixed', icon: 'apple', color: '#e4e4e7', isRecurring: true },
  { name: 'Avatar IA', kind: 'variable', icon: 'bot', color: '#a78bfa', isRecurring: false },
  { name: 'Perplexity', kind: 'variable', icon: 'search', color: '#4ade80', isRecurring: false },
  { name: 'Higgsfield', kind: 'variable', icon: 'video', color: '#fb923c', isRecurring: false },
  { name: 'Pletor', kind: 'variable', icon: 'box', color: '#64748b', isRecurring: false },
  { name: 'CSS Buy', kind: 'variable', icon: 'shopping-bag', color: '#fb923c', isRecurring: false },
  { name: 'Uber', kind: 'variable', icon: 'car', color: '#f87171', isRecurring: false },
  { name: 'Comidas fuera', kind: 'variable', icon: 'utensils', color: '#fb923c', isRecurring: false },
  { name: 'Juegos', kind: 'variable', icon: 'gamepad-2', color: '#a78bfa', isRecurring: false },
] as const;

const TICKER_ITEMS = [
  { displayLabel: 'BTC/USD', sourceType: 'crypto', sourceKey: 'bitcoin', orderIndex: 0 },
  { displayLabel: 'ADA/USD', sourceType: 'crypto', sourceKey: 'cardano', orderIndex: 1 },
  { displayLabel: 'SP500', sourceType: 'index', sourceKey: '^GSPC', orderIndex: 2 },
  { displayLabel: 'OFICIAL', sourceType: 'fx_ars', sourceKey: 'oficial', orderIndex: 3 },
  { displayLabel: 'BLUE', sourceType: 'fx_ars', sourceKey: 'blue', orderIndex: 4 },
  { displayLabel: 'USDT', sourceType: 'fx_ars', sourceKey: 'usdt', orderIndex: 5 },
] as const;

const SETTINGS: Array<{ key: string; value: string }> = [
  { key: 'default_rate_type', value: 'blue' },
];

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
```

- [ ] **Step 3: Run seed**

```bash
npm run db:seed
```

Expected: "Seed complete." and categories/ticker/settings persisted.

- [ ] **Step 4: Verify with Prisma Studio** (optional)

```bash
npm run db:studio
```

Expected: GUI at `localhost:5555` shows seeded rows. Ctrl+C to stop.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts prisma/seed.ts
git commit -m "feat(db): add Prisma client singleton and seed script"
```

---

## Phase 2 — Rate and price fetchers

All fetchers follow the same contract: pure async functions that hit an external API and return normalized data. They are tested with mocked `fetch`.

### Task 2.1: `dolarapi` fetcher (TDD)

**Files:**
- Create: `tests/rates/dolarapi.test.ts`, `lib/rates/dolarapi.ts`

- [ ] **Step 1: Write the failing test**

`tests/rates/dolarapi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDolarApiRates } from '@/lib/rates/dolarapi';

const SAMPLE_RESPONSE = [
  { casa: 'oficial', compra: 1050, venta: 1078, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'blue', compra: 1440, venta: 1465, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'bolsa', compra: 1390, venta: 1398, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'contadoconliqui', compra: 1405, venta: 1412, fechaActualizacion: '2026-04-21T10:00:00Z' },
  { casa: 'cripto', compra: 1450, venta: 1458, fechaActualizacion: '2026-04-21T10:00:00Z' },
];

describe('fetchDolarApiRates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an entry per known rate type with buy/sell prices', async () => {
    const rates = await fetchDolarApiRates();
    expect(rates).toHaveLength(5);
    const byType = Object.fromEntries(rates.map((r) => [r.type, r]));
    expect(byType.oficial).toMatchObject({ type: 'oficial', buyPrice: 1050, sellPrice: 1078 });
    expect(byType.blue).toMatchObject({ type: 'blue', buyPrice: 1440, sellPrice: 1465 });
    expect(byType.mep).toMatchObject({ type: 'mep', buyPrice: 1390, sellPrice: 1398 });
    expect(byType.ccl).toMatchObject({ type: 'ccl', buyPrice: 1405, sellPrice: 1412 });
    expect(byType.usdt).toMatchObject({ type: 'usdt', buyPrice: 1450, sellPrice: 1458 });
  });

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 500 })));
    await expect(fetchDolarApiRates()).rejects.toThrow(/dolarapi/i);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
npm test tests/rates/dolarapi.test.ts
```

Expected: fails because `lib/rates/dolarapi.ts` does not exist.

- [ ] **Step 3: Implement `lib/rates/dolarapi.ts`**

```typescript
export type RateType = 'oficial' | 'blue' | 'mep' | 'ccl' | 'usdt';

export interface NormalizedRate {
  type: RateType;
  buyPrice: number;
  sellPrice: number;
  fetchedAt: Date;
}

const CASA_MAP: Record<string, RateType> = {
  oficial: 'oficial',
  blue: 'blue',
  bolsa: 'mep',
  contadoconliqui: 'ccl',
  cripto: 'usdt',
};

interface DolarApiRow {
  casa: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export async function fetchDolarApiRates(): Promise<NormalizedRate[]> {
  const res = await fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`dolarapi request failed: ${res.status}`);
  }
  const rows = (await res.json()) as DolarApiRow[];
  return rows
    .filter((row) => CASA_MAP[row.casa])
    .map<NormalizedRate>((row) => ({
      type: CASA_MAP[row.casa],
      buyPrice: row.compra,
      sellPrice: row.venta,
      fetchedAt: new Date(row.fechaActualizacion),
    }));
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test tests/rates/dolarapi.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/rates/dolarapi.test.ts lib/rates/dolarapi.ts
git commit -m "feat(rates): add dolarapi fetcher"
```

---

### Task 2.2: CoinGecko fetcher (TDD)

**Files:**
- Create: `tests/rates/coingecko.test.ts`, `lib/rates/coingecko.ts`

- [ ] **Step 1: Write the failing test**

`tests/rates/coingecko.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCoinGeckoPrices } from '@/lib/rates/coingecko';

const SAMPLE = {
  bitcoin: { usd: 94820, usd_24h_change: -1.4 },
  cardano: { usd: 0.645, usd_24h_change: 2.1 },
};

describe('fetchCoinGeckoPrices', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns a NormalizedPrice per requested id', async () => {
    const prices = await fetchCoinGeckoPrices(['bitcoin', 'cardano']);
    expect(prices).toHaveLength(2);
    expect(prices[0]).toMatchObject({ ticker: 'bitcoin', price: 94820, changePct24h: -1.4 });
    expect(prices[1]).toMatchObject({ ticker: 'cardano', price: 0.645, changePct24h: 2.1 });
  });

  it('builds the ids query param correctly', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await fetchCoinGeckoPrices(['bitcoin', 'cardano']);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('ids=bitcoin%2Ccardano');
    expect(url).toContain('vs_currencies=usd');
    expect(url).toContain('include_24hr_change=true');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test tests/rates/coingecko.test.ts
```

- [ ] **Step 3: Implement `lib/rates/coingecko.ts`**

```typescript
export interface NormalizedPrice {
  ticker: string;
  price: number;
  changePct24h: number;
  fetchedAt: Date;
}

type CoinGeckoResponse = Record<string, { usd: number; usd_24h_change: number }>;

export async function fetchCoinGeckoPrices(ids: string[]): Promise<NormalizedPrice[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  });
  const url = `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`coingecko request failed: ${res.status}`);
  }
  const data = (await res.json()) as CoinGeckoResponse;
  const now = new Date();
  return ids.map((id) => ({
    ticker: id,
    price: data[id]?.usd ?? 0,
    changePct24h: data[id]?.usd_24h_change ?? 0,
    fetchedAt: now,
  }));
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test tests/rates/coingecko.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/rates/coingecko.test.ts lib/rates/coingecko.ts
git commit -m "feat(rates): add CoinGecko fetcher"
```

---

### Task 2.3: Yahoo Finance fetcher (TDD)

**Files:**
- Create: `tests/rates/yahoo.test.ts`, `lib/rates/yahoo.ts`

- [ ] **Step 1: Install `yahoo-finance2`**

```bash
npm install yahoo-finance2
```

- [ ] **Step 2: Write the failing test**

`tests/rates/yahoo.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchYahooPrices } from '@/lib/rates/yahoo';

vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn(async (symbols: string[]) =>
      symbols.map((s) => ({
        symbol: s,
        regularMarketPrice: s === '^GSPC' ? 5842.3 : 180,
        regularMarketChangePercent: s === '^GSPC' ? 0.32 : 1.5,
      })),
    ),
  },
}));

describe('fetchYahooPrices', () => {
  it('returns NormalizedPrice per symbol', async () => {
    const prices = await fetchYahooPrices(['^GSPC', 'AAPL']);
    expect(prices).toHaveLength(2);
    expect(prices[0]).toMatchObject({ ticker: '^GSPC', price: 5842.3, changePct24h: 0.32 });
    expect(prices[1]).toMatchObject({ ticker: 'AAPL', price: 180, changePct24h: 1.5 });
  });
});
```

- [ ] **Step 3: Run, confirm fail**

```bash
npm test tests/rates/yahoo.test.ts
```

- [ ] **Step 4: Implement `lib/rates/yahoo.ts`**

```typescript
import yahooFinance from 'yahoo-finance2';
import type { NormalizedPrice } from './coingecko';

export async function fetchYahooPrices(symbols: string[]): Promise<NormalizedPrice[]> {
  if (symbols.length === 0) return [];
  const results = await yahooFinance.quote(symbols);
  const rows = Array.isArray(results) ? results : [results];
  const now = new Date();
  return rows.map((row) => ({
    ticker: row.symbol,
    price: Number(row.regularMarketPrice ?? 0),
    changePct24h: Number(row.regularMarketChangePercent ?? 0),
    fetchedAt: now,
  }));
}
```

- [ ] **Step 5: Run, confirm pass**

```bash
npm test tests/rates/yahoo.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add tests/rates/yahoo.test.ts lib/rates/yahoo.ts package.json package-lock.json
git commit -m "feat(rates): add Yahoo Finance fetcher"
```

---

### Task 2.4: Frankfurter FX fetcher (TDD)

**Files:**
- Create: `tests/rates/frankfurter.test.ts`, `lib/rates/frankfurter.ts`

- [ ] **Step 1: Write the failing test**

`tests/rates/frankfurter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFrankfurterPair } from '@/lib/rates/frankfurter';

describe('fetchFrankfurterPair', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ amount: 1, base: 'EUR', date: '2026-04-21', rates: { USD: 1.08 } }), { status: 200 })
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns rate for pair EUR → USD', async () => {
    const price = await fetchFrankfurterPair('EUR', 'USD');
    expect(price).toMatchObject({ ticker: 'EUR/USD', price: 1.08, changePct24h: 0 });
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test tests/rates/frankfurter.test.ts
```

- [ ] **Step 3: Implement `lib/rates/frankfurter.ts`**

```typescript
import type { NormalizedPrice } from './coingecko';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchFrankfurterPair(from: string, to: string): Promise<NormalizedPrice> {
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`frankfurter request failed: ${res.status}`);
  }
  const data = (await res.json()) as FrankfurterResponse;
  return {
    ticker: `${from}/${to}`,
    price: data.rates[to] ?? 0,
    changePct24h: 0,
    fetchedAt: new Date(data.date),
  };
}
```

Note: Frankfurter does not expose 24h change, so `changePct24h` is 0. The UI hides the delta when it's exactly 0.

- [ ] **Step 4: Run, confirm pass**

```bash
npm test tests/rates/frankfurter.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/rates/frankfurter.test.ts lib/rates/frankfurter.ts
git commit -m "feat(rates): add Frankfurter FX fetcher"
```

---

### Task 2.5: Unified rate refresh + API routes

**Files:**
- Create: `lib/rates/index.ts`, `app/api/rates/route.ts`, `app/api/rates/refresh/route.ts`, `app/api/rates/history/route.ts`, `app/api/market/[ticker]/route.ts`

- [ ] **Step 1: Write `lib/rates/index.ts`**

```typescript
import { db } from '@/lib/db';
import { fetchDolarApiRates } from './dolarapi';
import { fetchCoinGeckoPrices } from './coingecko';
import { fetchYahooPrices } from './yahoo';

const RATES_TTL_MIN = 5;
const MARKET_TTL_MIN = 2;

function minutesAgo(date: Date): number {
  return (Date.now() - date.getTime()) / 60000;
}

export async function getLatestExchangeRates() {
  return db.exchangeRate.findMany({
    orderBy: { fetchedAt: 'desc' },
    distinct: ['type'],
  });
}

export async function getLatestMarketPrices() {
  return db.marketPrice.findMany({
    orderBy: { fetchedAt: 'desc' },
    distinct: ['ticker'],
  });
}

export async function refreshExchangeRates() {
  const rates = await fetchDolarApiRates();
  await db.exchangeRate.createMany({
    data: rates.map((r) => ({
      type: r.type,
      buyPrice: r.buyPrice,
      sellPrice: r.sellPrice,
      fetchedAt: r.fetchedAt,
    })),
  });
}

export async function refreshMarketPricesIfStale() {
  const tickerItems = await db.tickerItem.findMany({ where: { isVisible: true } });
  const cryptos = tickerItems.filter((t) => t.sourceType === 'crypto').map((t) => t.sourceKey);
  const stocks = tickerItems.filter((t) => t.sourceType === 'stock' || t.sourceType === 'index').map((t) => t.sourceKey);

  const latest = await getLatestMarketPrices();
  const byTicker = new Map(latest.map((m) => [m.ticker, m]));

  const staleCryptos = cryptos.filter((id) => {
    const found = byTicker.get(id);
    return !found || minutesAgo(found.fetchedAt) >= MARKET_TTL_MIN;
  });
  const staleStocks = stocks.filter((id) => {
    const found = byTicker.get(id);
    return !found || minutesAgo(found.fetchedAt) >= 5;
  });

  const [cryptoPrices, stockPrices] = await Promise.all([
    staleCryptos.length ? fetchCoinGeckoPrices(staleCryptos) : Promise.resolve([]),
    staleStocks.length ? fetchYahooPrices(staleStocks) : Promise.resolve([]),
  ]);

  const toInsert = [...cryptoPrices, ...stockPrices];
  if (toInsert.length) {
    await db.marketPrice.createMany({
      data: toInsert.map((p) => ({
        ticker: p.ticker,
        price: p.price,
        changePct24h: p.changePct24h,
        fetchedAt: p.fetchedAt,
      })),
    });
  }
}

export async function refreshRatesIfStale() {
  const latest = await getLatestExchangeRates();
  const oldestOrMissing =
    latest.length < 5 || Math.min(...latest.map((l) => minutesAgo(l.fetchedAt))) >= RATES_TTL_MIN;
  if (oldestOrMissing) {
    await refreshExchangeRates();
  }
}
```

- [ ] **Step 2: Write `app/api/rates/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getLatestExchangeRates, refreshRatesIfStale } from '@/lib/rates';

export async function GET() {
  try {
    await refreshRatesIfStale();
  } catch (err) {
    console.error('rate refresh failed', err);
  }
  const rates = await getLatestExchangeRates();
  return NextResponse.json({ rates });
}
```

- [ ] **Step 3: Write `app/api/rates/refresh/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { refreshExchangeRates, refreshMarketPricesIfStale } from '@/lib/rates';

export async function POST() {
  await Promise.all([refreshExchangeRates(), refreshMarketPricesIfStale()]);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write `app/api/rates/history/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'blue';
  const days = Number(searchParams.get('days') ?? '30');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const history = await db.exchangeRate.findMany({
    where: { type: type as 'oficial' | 'blue' | 'mep' | 'ccl' | 'usdt', fetchedAt: { gte: since } },
    orderBy: { fetchedAt: 'asc' },
  });
  return NextResponse.json({ history });
}
```

- [ ] **Step 5: Write `app/api/market/[ticker]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { refreshMarketPricesIfStale } from '@/lib/rates';

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  try {
    await refreshMarketPricesIfStale();
  } catch (err) {
    console.error('market refresh failed', err);
  }
  const latest = await db.marketPrice.findFirst({
    where: { ticker },
    orderBy: { fetchedAt: 'desc' },
  });
  return NextResponse.json({ price: latest });
}
```

- [ ] **Step 6: Sanity check the API routes**

Run `npm run dev` and browse to `http://localhost:3000/api/rates`. Expected: JSON object `{ "rates": [...] }`. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git add lib/rates/index.ts app/api
git commit -m "feat(rates): unified rate refresh + API routes"
```

---

## Phase 3 — UI shell (layout, sidebar, ticker, design tokens)

### Task 3.1: Design tokens and global styles

**Files:**
- Modify: `app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Replace `app/globals.css`**

```css
@import 'tailwindcss';

@theme {
  --color-bg-primary: #08080c;
  --color-bg-card: #0d0d14;
  --color-border: #1a1a22;
  --color-border-soft: #17171f;
  --color-text-primary: #ffffff;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;
  --color-accent: #8b5cf6;
  --color-accent-soft: #a78bfa;
  --color-success: #4ade80;
  --color-danger: #f87171;
  --color-warning: #fb923c;
  --font-sans: Inter, system-ui, sans-serif;
}

html, body {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

* {
  border-color: var(--color-border);
}
```

- [ ] **Step 2: Add Inter to `app/layout.tsx`**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Ticker } from '@/components/layout/Ticker';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Finanzas',
  description: 'Panel de finanzas personales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen">
        <Ticker />
        <div className="grid grid-cols-[180px_1fr]">
          <Sidebar />
          <main className="p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat(ui): design tokens and root layout"
```

---

### Task 3.2: Sidebar component

**Files:**
- Create: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Write `components/layout/Sidebar.tsx`**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  FileText,
  Settings,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transacciones', label: 'Transacciones', icon: ArrowUpDown },
  { href: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { href: '/gastos', label: 'Gastos', icon: TrendingDown },
  { href: '/inversiones', label: 'Inversiones', icon: DollarSign },
  { href: '/patrimonio', label: 'Patrimonio', icon: Wallet },
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="min-h-[calc(100vh-42px)] border-r border-[#17171f] bg-[#0a0a10] px-2 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[#8b5cf6] to-[#6366f1]">
          <DollarSign className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-bold">Finanzas</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] transition ${
                active ? 'bg-[#17171f] text-white' : 'text-[#71717a] hover:text-white'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#a78bfa]' : ''}`} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create empty page stubs so navigation works**

For each route in nav, create a stub page. Example for `app/transacciones/page.tsx`:

```typescript
export default function TransaccionesPage() {
  return <h1 className="text-2xl font-bold">Transacciones</h1>;
}
```

Create identical stubs at: `app/ingresos/page.tsx`, `app/gastos/page.tsx`, `app/inversiones/page.tsx`, `app/patrimonio/page.tsx`, `app/reportes/page.tsx`, `app/ajustes/page.tsx` (change label each time).

- [ ] **Step 3: Visual check**

```bash
npm run dev
```

Browse `http://localhost:3000`. Expected: dark sidebar with 8 nav items, active item highlighted as you navigate.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx app/transacciones app/ingresos app/gastos app/inversiones app/patrimonio app/reportes app/ajustes
git commit -m "feat(ui): sidebar navigation + page stubs"
```

---

### Task 3.3: Ticker component with live data

**Files:**
- Create: `components/layout/Ticker.tsx`, `components/providers/QueryProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install and wire TanStack Query provider**

Create `components/providers/QueryProvider.tsx`:

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Update `app/layout.tsx` body to wrap everything in `<QueryProvider>`:

```typescript
import { QueryProvider } from '@/components/providers/QueryProvider';

// ... inside RootLayout:
return (
  <html lang="es" className={inter.variable}>
    <body className="min-h-screen">
      <QueryProvider>
        <Ticker />
        <div className="grid grid-cols-[180px_1fr]">
          <Sidebar />
          <main className="p-6">{children}</main>
        </div>
      </QueryProvider>
    </body>
  </html>
);
```

- [ ] **Step 2: Write `components/layout/Ticker.tsx`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';

interface TickerItem {
  id: number;
  displayLabel: string;
  sourceType: 'fx_ars' | 'fx_usd' | 'crypto' | 'stock' | 'index';
  sourceKey: string;
  orderIndex: number;
  isVisible: boolean;
}

interface TickerValue {
  label: string;
  value: number;
  deltaPct: number;
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }
  return n.toLocaleString('es-AR', { maximumFractionDigits: 4 });
}

export function Ticker() {
  const { data } = useQuery<{ items: TickerValue[] }>({
    queryKey: ['ticker'],
    queryFn: async () => {
      const res = await fetch('/api/ticker');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];

  return (
    <div className="flex gap-7 overflow-hidden whitespace-nowrap border-b border-[#17171f] bg-[#0a0a10] px-5 py-2 text-[10px]">
      {items.length === 0 && <span className="text-[#71717a]">Cargando cotizaciones…</span>}
      {items.map((item) => {
        const up = item.deltaPct > 0;
        const down = item.deltaPct < 0;
        return (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="font-semibold tracking-wide text-[#71717a]">{item.label}</span>
            <span className="font-semibold text-white">${formatNumber(item.value)}</span>
            {item.deltaPct !== 0 && (
              <span className={`text-[9px] ${up ? 'text-[#4ade80]' : down ? 'text-[#f87171]' : 'text-[#71717a]'}`}>
                {up ? '+' : ''}
                {item.deltaPct.toFixed(2)}%
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `/api/ticker/route.ts` endpoint**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { refreshRatesIfStale, refreshMarketPricesIfStale, getLatestExchangeRates, getLatestMarketPrices } from '@/lib/rates';

export async function GET() {
  try {
    await Promise.all([refreshRatesIfStale(), refreshMarketPricesIfStale()]);
  } catch (err) {
    console.error('ticker refresh failed', err);
  }
  const [tickerItems, exchangeRates, marketPrices] = await Promise.all([
    db.tickerItem.findMany({ where: { isVisible: true }, orderBy: { orderIndex: 'asc' } }),
    getLatestExchangeRates(),
    getLatestMarketPrices(),
  ]);

  const fxByType = new Map(exchangeRates.map((r) => [r.type, r]));
  const priceByTicker = new Map(marketPrices.map((p) => [p.ticker, p]));

  const items = tickerItems
    .map((t) => {
      if (t.sourceType === 'fx_ars') {
        const rate = fxByType.get(t.sourceKey as 'oficial' | 'blue' | 'mep' | 'ccl' | 'usdt');
        if (!rate) return null;
        return { label: t.displayLabel, value: Number(rate.sellPrice), deltaPct: 0 };
      }
      const p = priceByTicker.get(t.sourceKey);
      if (!p) return null;
      return { label: t.displayLabel, value: Number(p.price), deltaPct: Number(p.changePct24h) };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}
```

- [ ] **Step 4: Visual check**

```bash
npm run dev
```

First load pulls rates; after a moment ticker populates with BTC, ADA, SP500, OFICIAL, BLUE, USDT. If any is missing, check console for fetch errors.

- [ ] **Step 5: Commit**

```bash
git add components/layout/Ticker.tsx components/providers/QueryProvider.tsx app/layout.tsx app/api/ticker
git commit -m "feat(ui): live-updating ticker + QueryProvider"
```

---

## Phase 4 — Dashboard (KPIs + charts)

### Task 4.1: Dashboard query helpers

**Files:**
- Create: `lib/format.ts`, `lib/convert.ts`, `lib/queries/dashboard.ts`
- Create: `tests/convert.test.ts`

- [ ] **Step 1: Write convert test**

`tests/convert.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toUsd } from '@/lib/convert';

describe('toUsd', () => {
  it('returns amount unchanged when currency is USD', () => {
    expect(toUsd({ amount: 100, currency: 'USD' }, 1465)).toBe(100);
  });

  it('divides ARS amount by the rate', () => {
    expect(toUsd({ amount: 146500, currency: 'ARS' }, 1465)).toBe(100);
  });

  it('returns 0 when rate is 0 to avoid division by zero', () => {
    expect(toUsd({ amount: 100, currency: 'ARS' }, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test tests/convert.test.ts
```

- [ ] **Step 3: Implement `lib/convert.ts`**

```typescript
export type Currency = 'USD' | 'ARS';

export function toUsd(entry: { amount: number; currency: Currency }, arsPerUsd: number): number {
  if (entry.currency === 'USD') return entry.amount;
  if (arsPerUsd <= 0) return 0;
  return entry.amount / arsPerUsd;
}

export function toArs(entry: { amount: number; currency: Currency }, arsPerUsd: number): number {
  if (entry.currency === 'ARS') return entry.amount;
  return entry.amount * arsPerUsd;
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test tests/convert.test.ts
```

- [ ] **Step 5: Implement `lib/format.ts`**

```typescript
export function formatArs(n: number): string {
  return `ARS ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUsd(n: number): string {
  return `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(n: number, digits = 1): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}
```

- [ ] **Step 6: Implement `lib/queries/dashboard.ts`**

```typescript
import 'server-only';
import { db } from '@/lib/db';
import { toUsd } from '@/lib/convert';

async function activeRate(type: 'oficial' | 'blue' | 'mep' | 'ccl' | 'usdt' = 'blue') {
  const latest = await db.exchangeRate.findFirst({
    where: { type },
    orderBy: { fetchedAt: 'desc' },
  });
  return latest ? Number(latest.sellPrice) : 0;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export async function getMonthlyKpis(reference: Date = new Date()) {
  const rate = await activeRate();
  const monthStart = startOfMonth(reference);
  const monthEnd = startOfNextMonth(reference);
  const prevMonthStart = startOfMonth(new Date(reference.getFullYear(), reference.getMonth() - 1, 1));

  const [thisMonth, prevMonth, assets, liabilities] = await Promise.all([
    db.transaction.findMany({ where: { date: { gte: monthStart, lt: monthEnd } } }),
    db.transaction.findMany({ where: { date: { gte: prevMonthStart, lt: monthStart } } }),
    db.asset.findMany(),
    db.liability.findMany(),
  ]);

  const sumByType = (rows: typeof thisMonth, type: 'income' | 'expense') =>
    rows
      .filter((r) => r.type === type)
      .reduce((acc, r) => acc + toUsd({ amount: Number(r.amount), currency: r.currency }, rate), 0);

  const incomeUsd = sumByType(thisMonth, 'income');
  const expenseUsd = sumByType(thisMonth, 'expense');
  const prevIncomeUsd = sumByType(prevMonth, 'income');
  const prevExpenseUsd = sumByType(prevMonth, 'expense');

  const assetsUsd = assets.reduce((acc, a) => acc + toUsd({ amount: Number(a.manualValue ?? 0), currency: a.currency }, rate), 0);
  const liabilitiesUsd = liabilities.reduce((acc, l) => acc + toUsd({ amount: Number(l.amount), currency: l.currency }, rate), 0);

  return {
    rate,
    income: incomeUsd,
    expense: expenseUsd,
    balance: incomeUsd - expenseUsd,
    netWorth: assetsUsd - liabilitiesUsd,
    deltaIncomePct: prevIncomeUsd ? ((incomeUsd - prevIncomeUsd) / prevIncomeUsd) * 100 : 0,
    deltaExpensePct: prevExpenseUsd ? ((expenseUsd - prevExpenseUsd) / prevExpenseUsd) * 100 : 0,
  };
}

export async function getIncomeComparisonSeries(yearA: number, yearB: number) {
  const rows = await db.transaction.findMany({
    where: { type: 'income', date: { gte: new Date(yearA, 0, 1), lt: new Date(yearB + 1, 0, 1) } },
  });
  const build = (year: number) => {
    const totals = Array.from({ length: 12 }, () => 0);
    for (const r of rows) {
      if (r.date.getFullYear() !== year) continue;
      if (r.currency !== 'USD') continue;
      totals[r.date.getMonth()] += Number(r.amount);
    }
    return totals;
  };
  return {
    [yearA]: build(yearA),
    [yearB]: build(yearB),
  };
}

export async function getCashflowSeries(year: number) {
  const rate = await activeRate();
  const rows = await db.transaction.findMany({
    where: { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
  });
  const income = Array.from({ length: 12 }, () => 0);
  const expense = Array.from({ length: 12 }, () => 0);
  for (const r of rows) {
    const ars = r.currency === 'USD' ? Number(r.amount) * rate : Number(r.amount);
    if (r.type === 'income') income[r.date.getMonth()] += ars;
    else expense[r.date.getMonth()] += ars;
  }
  return { income, expense };
}

export async function getTopCategories(reference: Date = new Date()) {
  const monthStart = startOfMonth(reference);
  const monthEnd = startOfNextMonth(reference);
  const rows = await db.transaction.findMany({
    where: { type: 'expense', date: { gte: monthStart, lt: monthEnd } },
    include: { category: true },
  });
  const byCat = new Map<string, { name: string; color: string; amount: number }>();
  for (const r of rows) {
    const key = r.category.name;
    const prev = byCat.get(key) ?? { name: key, color: r.category.color, amount: 0 };
    prev.amount += Number(r.amount);
    byCat.set(key, prev);
  }
  return Array.from(byCat.values()).sort((a, b) => b.amount - a.amount).slice(0, 6);
}

export async function getAssetAllocation() {
  const rate = await activeRate();
  const assets = await db.asset.findMany();
  const buckets = { usd: 0, invest: 0, ars: 0, other: 0 };
  for (const a of assets) {
    const usd = toUsd({ amount: Number(a.manualValue ?? 0), currency: a.currency }, rate);
    if (a.type === 'cash_usd') buckets.usd += usd;
    else if (a.type === 'cash_ars') buckets.ars += usd;
    else if (a.type === 'stock' || a.type === 'crypto') buckets.invest += usd;
    else buckets.other += usd;
  }
  return buckets;
}

export async function getNetWorthSeries(days = 180) {
  const since = new Date(Date.now() - days * 86400000);
  return db.snapshot.findMany({ where: { date: { gte: since } }, orderBy: { date: 'asc' } });
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/convert.ts lib/format.ts lib/queries/dashboard.ts tests/convert.test.ts
git commit -m "feat(lib): currency/format helpers + dashboard query layer"
```

---

### Task 4.2: KPI card component

**Files:**
- Create: `components/dashboard/KPICard.tsx`

- [ ] **Step 1: Write `components/dashboard/KPICard.tsx`**

```typescript
import { LucideIcon } from 'lucide-react';
import { formatPct } from '@/lib/format';

interface Props {
  label: string;
  value: string;
  accent: 'purple' | 'green' | 'red' | 'orange';
  icon: LucideIcon;
  deltaPct?: number;
  subText?: string;
  sparkline?: number[];
}

const ACCENT: Record<Props['accent'], { glow: string; iconBg: string; iconColor: string; stroke: string }> = {
  purple: { glow: 'from-[#8b5cf6]/10', iconBg: 'bg-[#8b5cf6]/15', iconColor: 'text-[#a78bfa]', stroke: '#a78bfa' },
  green:  { glow: 'from-[#4ade80]/10', iconBg: 'bg-[#4ade80]/15', iconColor: 'text-[#4ade80]', stroke: '#4ade80' },
  red:    { glow: 'from-[#f87171]/10', iconBg: 'bg-[#f87171]/15', iconColor: 'text-[#f87171]', stroke: '#f87171' },
  orange: { glow: 'from-[#fb923c]/10', iconBg: 'bg-[#fb923c]/15', iconColor: 'text-[#fb923c]', stroke: '#fb923c' },
};

export function KPICard({ label, value, accent, icon: Icon, deltaPct, subText, sparkline }: Props) {
  const a = ACCENT[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#1a1a22] bg-gradient-to-b ${a.glow} to-transparent`}
    >
      <div className="bg-[#0d0d14]/80 p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider text-[#a1a1aa]">{label}</span>
          <span className={`grid h-[22px] w-[22px] place-items-center rounded-md ${a.iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${a.iconColor}`} />
          </span>
        </div>
        <div className="text-[17px] font-bold">{value}</div>
        <div className="mt-1 flex items-center gap-1 text-[10px]">
          {typeof deltaPct === 'number' && deltaPct !== 0 && (
            <span className={deltaPct > 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}>
              {deltaPct > 0 ? '▲' : '▼'} {formatPct(deltaPct)}
            </span>
          )}
          {subText && <span className="text-[#a1a1aa]">{subText}</span>}
        </div>
        {sparkline && <Sparkline values={sparkline} color={a.stroke} />}
      </div>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 50;
  const h = 18;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg className="absolute bottom-2.5 right-2.5 h-[18px] w-[50px] opacity-80" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/KPICard.tsx
git commit -m "feat(dashboard): KPICard component"
```

---

### Task 4.3: Chart components (Area, Comparison, Cashflow, Donut, Breakdown)

**Files:**
- Create: `components/dashboard/AreaChart.tsx`, `ComparisonChart.tsx`, `CashflowChart.tsx`, `AssetDonut.tsx`, `CategoryBreakdown.tsx`

- [ ] **Step 1: `components/dashboard/AreaChart.tsx`**

```typescript
'use client';

import { Area, AreaChart as RC, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Point {
  label: string;
  value: number;
}

export function AreaChart({ data, color = '#8b5cf6', height = 200, unit = 'USD' }: { data: Point[]; color?: string; height?: number; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RC data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#17171f" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${Math.round(v)}`} />
        <Tooltip
          cursor={{ stroke: color, strokeDasharray: '3 3' }}
          contentStyle={{ background: '#1a1a22', border: '1px solid #2a2a32', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: '#71717a' }}
          formatter={(value: number) => [`${unit} ${value.toLocaleString('es-AR')}`, 'Valor']}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#areaFill)" />
      </RC>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: `components/dashboard/ComparisonChart.tsx`**

```typescript
'use client';

import { Area, AreaChart as RC, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function ComparisonChart({ seriesA, seriesB, labelA, labelB }: { seriesA: number[]; seriesB: number[]; labelA: string; labelB: string }) {
  const data = MONTHS.map((m, i) => ({ label: m, [labelA]: seriesA[i], [labelB]: seriesB[i] ?? null }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RC data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="cmpA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#4ade80" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="cmpB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#fb923c" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#17171f" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#1a1a22', border: '1px solid #2a2a32', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: '#71717a' }}
          formatter={(v: number) => `USD ${v.toLocaleString('es-AR')}`}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Area type="monotone" dataKey={labelA} stroke="#4ade80" strokeWidth={2} fill="url(#cmpA)" />
        <Area type="monotone" dataKey={labelB} stroke="#fb923c" strokeWidth={2} fill="url(#cmpB)" />
      </RC>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: `components/dashboard/CashflowChart.tsx`**

```typescript
'use client';

import { Bar, BarChart as RC, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function CashflowChart({ income, expense }: { income: number[]; expense: number[] }) {
  const data = MONTHS.map((m, i) => ({ label: m, Ingresos: income[i], Gastos: expense[i] }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RC data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#17171f" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip
          cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
          contentStyle={{ background: '#1a1a22', border: '1px solid #2a2a32', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: '#71717a' }}
          formatter={(v: number) => `ARS ${v.toLocaleString('es-AR')}`}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="Ingresos" fill="#4ade80" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Gastos" fill="#f87171" radius={[2, 2, 0, 0]} />
      </RC>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: `components/dashboard/AssetDonut.tsx`**

```typescript
'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  buckets: { usd: number; invest: number; ars: number; other: number };
}

export function AssetDonut({ buckets }: Props) {
  const data = [
    { name: 'USD Cash', value: buckets.usd, color: '#8b5cf6' },
    { name: 'Inversiones', value: buckets.invest, color: '#4ade80' },
    { name: 'ARS Líquido', value: buckets.ars, color: '#fb923c' },
    { name: 'Otros', value: buckets.other, color: '#64748b' },
  ].filter((d) => d.value > 0);

  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie data={data} innerRadius={34} outerRadius={54} paddingAngle={3} dataKey="value">
              {data.map((d, i) => <Cell key={i} fill={d.color} stroke="#0d0d14" />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1a1a22', border: '1px solid #2a2a32', borderRadius: 6, fontSize: 11 }}
              formatter={(v: number) => `USD ${v.toLocaleString('es-AR')}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 text-[10px] text-[#a1a1aa]">
        {data.map((d) => (
          <li key={d.name} className="my-0.5 flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-sm" style={{ background: d.color }} />
            {d.name}
            <span className="ml-auto font-semibold text-white">{total ? `${Math.round((d.value / total) * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: `components/dashboard/CategoryBreakdown.tsx`**

```typescript
'use client';

import { formatArs } from '@/lib/format';

export function CategoryBreakdown({ rows }: { rows: Array<{ name: string; color: string; amount: number }> }) {
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div className="space-y-1.5 text-[10px]">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between">
          <span className="w-24 truncate text-[#a1a1aa]">{r.name}</span>
          <div className="mx-2.5 h-1.5 flex-1 overflow-hidden rounded-full bg-[#17171f]">
            <div className="h-full rounded-full" style={{ width: `${(r.amount / max) * 100}%`, background: r.color }} />
          </div>
          <span className="w-20 text-right font-semibold text-white">{formatArs(r.amount)}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/dashboard
git commit -m "feat(dashboard): chart components (Area, Comparison, Cashflow, Donut, Breakdown)"
```

---

### Task 4.4: Assemble the dashboard page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite `app/page.tsx`**

```typescript
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { AreaChart } from '@/components/dashboard/AreaChart';
import { ComparisonChart } from '@/components/dashboard/ComparisonChart';
import { CashflowChart } from '@/components/dashboard/CashflowChart';
import { AssetDonut } from '@/components/dashboard/AssetDonut';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import {
  getMonthlyKpis,
  getIncomeComparisonSeries,
  getCashflowSeries,
  getTopCategories,
  getAssetAllocation,
  getNetWorthSeries,
} from '@/lib/queries/dashboard';
import { formatArs, formatUsd } from '@/lib/format';

export default async function DashboardPage() {
  const now = new Date();
  const [kpis, incomeCmp, cashflow, top, allocation, netWorthHistory] = await Promise.all([
    getMonthlyKpis(now),
    getIncomeComparisonSeries(now.getFullYear() - 1, now.getFullYear()),
    getCashflowSeries(now.getFullYear()),
    getTopCategories(now),
    getAssetAllocation(),
    getNetWorthSeries(180),
  ]);

  const netWorthData = netWorthHistory.map((s) => ({
    label: s.date.toISOString().slice(5, 10),
    value: Number(s.netWorthUsd),
  }));

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="mt-1 text-[11px] text-[#71717a]">Administrá y optimizá tu situación financiera</p>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-2.5">
        <KPICard label="Patrimonio" value={formatUsd(kpis.netWorth)} accent="purple" icon={Wallet} />
        <KPICard label="Ingresos" value={formatUsd(kpis.income)} accent="green" icon={TrendingUp} deltaPct={kpis.deltaIncomePct} subText={`ARS ${(kpis.income * kpis.rate).toLocaleString('es-AR')}`} />
        <KPICard label="Gastos" value={formatUsd(kpis.expense)} accent="red" icon={TrendingDown} deltaPct={-kpis.deltaExpensePct} />
        <KPICard label="Balance" value={formatArs(kpis.balance * kpis.rate)} accent="orange" icon={DollarSign} />
      </section>

      <section className="grid grid-cols-[2fr_1fr] gap-2.5">
        <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
          <h2 className="mb-3 text-xs font-semibold">Evolución del Patrimonio</h2>
          <AreaChart data={netWorthData} />
        </div>
        <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
          <h2 className="mb-3 text-xs font-semibold">Asignación de Activos</h2>
          <AssetDonut buckets={allocation} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
          <h2 className="mb-3 text-xs font-semibold">Ingresos {now.getFullYear() - 1} vs {now.getFullYear()}</h2>
          <ComparisonChart
            seriesA={incomeCmp[now.getFullYear() - 1]}
            seriesB={incomeCmp[now.getFullYear()]}
            labelA={String(now.getFullYear() - 1)}
            labelB={String(now.getFullYear())}
          />
        </div>
        <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
          <h2 className="mb-3 text-xs font-semibold">Top categorías de gasto</h2>
          <CategoryBreakdown rows={top} />
        </div>
      </section>

      <section className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
        <h2 className="mb-3 text-xs font-semibold">Flujo de caja mensual</h2>
        <CashflowChart income={cashflow.income} expense={cashflow.expense} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Visual check**

```bash
npm run dev
```

Browse to `/`. Expected: dashboard renders with empty charts (no data yet) but no errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(dashboard): assemble dashboard page"
```

---

## Phase 5 — Transactions (Ingresos + Gastos)

### Task 5.1: Server Actions for transactions

**Files:**
- Create: `app/actions/transactions.ts`, `app/actions/categories.ts`

- [ ] **Step 1: `app/actions/transactions.ts`**

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const TransactionInput = z.object({
  id: z.number().int().optional(),
  date: z.coerce.date(),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'ARS']),
  categoryId: z.coerce.number().int().positive(),
  note: z.string().nullable().optional(),
});

export async function saveTransaction(input: unknown) {
  const parsed = TransactionInput.parse(input);
  if (parsed.id) {
    await db.transaction.update({
      where: { id: parsed.id },
      data: {
        date: parsed.date,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        categoryId: parsed.categoryId,
        note: parsed.note ?? null,
      },
    });
  } else {
    await db.transaction.create({
      data: {
        date: parsed.date,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        categoryId: parsed.categoryId,
        note: parsed.note ?? null,
      },
    });
  }
  revalidatePath('/');
  revalidatePath('/ingresos');
  revalidatePath('/gastos');
  revalidatePath('/transacciones');
}

export async function deleteTransaction(id: number) {
  await db.transaction.delete({ where: { id } });
  revalidatePath('/');
  revalidatePath('/ingresos');
  revalidatePath('/gastos');
  revalidatePath('/transacciones');
}
```

- [ ] **Step 2: `app/actions/categories.ts`**

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const CategoryInput = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  kind: z.enum(['fixed', 'variable', 'income']),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  isRecurring: z.boolean(),
});

export async function saveCategory(input: unknown) {
  const parsed = CategoryInput.parse(input);
  if (parsed.id) {
    await db.category.update({ where: { id: parsed.id }, data: parsed });
  } else {
    await db.category.create({ data: parsed });
  }
  revalidatePath('/ajustes');
  revalidatePath('/gastos');
  revalidatePath('/ingresos');
}

export async function deleteCategory(id: number) {
  await db.category.delete({ where: { id } });
  revalidatePath('/ajustes');
}
```

- [ ] **Step 3: Commit**

```bash
git add app/actions
git commit -m "feat(actions): transaction + category server actions"
```

---

### Task 5.2: Transaction form component

**Files:**
- Create: `components/forms/TransactionForm.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client';

import { useState, useTransition } from 'react';
import { saveTransaction } from '@/app/actions/transactions';

interface Category { id: number; name: string; kind: 'fixed' | 'variable' | 'income' }

interface Props {
  categories: Category[];
  defaultValues?: {
    id?: number;
    date?: string;
    type: 'income' | 'expense';
    amount?: number;
    currency: 'USD' | 'ARS';
    categoryId?: number;
    note?: string;
  };
  onDone?: () => void;
}

export function TransactionForm({ categories, defaultValues, onDone }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const filteredCats = categories.filter((c) => (defaultValues?.type === 'income' ? c.kind === 'income' : c.kind !== 'income'));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = Object.fromEntries(fd.entries());
        startTransition(async () => {
          try {
            await saveTransaction({ ...data, id: defaultValues?.id });
            onDone?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        });
      }}
    >
      <input type="hidden" name="type" value={defaultValues?.type ?? 'expense'} />
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Fecha</span>
        <input name="date" type="date" defaultValue={defaultValues?.date ?? today} required className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" />
      </label>
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Monto</span>
        <input name="amount" type="number" step="0.01" min="0.01" defaultValue={defaultValues?.amount} required className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" />
      </label>
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Moneda</span>
        <select name="currency" defaultValue={defaultValues?.currency ?? 'ARS'} className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white">
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Categoría</span>
        <select name="categoryId" defaultValue={defaultValues?.categoryId} required className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white">
          <option value="">—</option>
          {filteredCats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </label>
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Nota</span>
        <input name="note" type="text" defaultValue={defaultValues?.note} className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" />
      </label>
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded bg-[#8b5cf6] py-2 text-xs font-semibold text-white disabled:opacity-50">
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/forms/TransactionForm.tsx
git commit -m "feat(forms): TransactionForm component"
```

---

### Task 5.3: Ingresos page

**Files:**
- Modify: `app/ingresos/page.tsx`
- Create: `app/ingresos/IngresosClient.tsx`

- [ ] **Step 1: Write `app/ingresos/page.tsx`**

```typescript
import { db } from '@/lib/db';
import { getIncomeComparisonSeries } from '@/lib/queries/dashboard';
import { ComparisonChart } from '@/components/dashboard/ComparisonChart';
import { IngresosClient } from './IngresosClient';

export default async function IngresosPage() {
  const now = new Date();
  const yearA = now.getFullYear() - 1;
  const yearB = now.getFullYear();
  const [series, categories] = await Promise.all([
    getIncomeComparisonSeries(yearA, yearB),
    db.category.findMany({ where: { kind: 'income' } }),
  ]);
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const rows = MONTHS.map((m, i) => ({
    month: m,
    a: series[yearA][i],
    b: series[yearB][i],
  }));
  const totalA = series[yearA].reduce((x, y) => x + y, 0);
  const totalB = series[yearB].reduce((x, y) => x + y, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ingresos</h1>
        <IngresosClient categories={categories} />
      </div>
      <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
        <ComparisonChart seriesA={series[yearA]} seriesB={series[yearB]} labelA={String(yearA)} labelB={String(yearB)} />
      </div>
      <table className="w-full text-xs">
        <thead className="text-[#a1a1aa]">
          <tr><th className="text-left p-2">Mes</th><th className="text-right p-2">{yearA}</th><th className="text-right p-2">{yearB}</th><th className="text-right p-2">Diferencia</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-t border-[#17171f]">
              <td className="p-2">{r.month}</td>
              <td className="p-2 text-right">USD {r.a.toLocaleString('es-AR')}</td>
              <td className="p-2 text-right">USD {r.b.toLocaleString('es-AR')}</td>
              <td className={`p-2 text-right ${(r.b - r.a) >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>USD {(r.b - r.a).toLocaleString('es-AR')}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[#2a2a32] font-bold">
            <td className="p-2">TOTAL</td>
            <td className="p-2 text-right">USD {totalA.toLocaleString('es-AR')}</td>
            <td className="p-2 text-right">USD {totalB.toLocaleString('es-AR')}</td>
            <td className="p-2 text-right">USD {(totalB - totalA).toLocaleString('es-AR')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/ingresos/IngresosClient.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TransactionForm } from '@/components/forms/TransactionForm';

export function IngresosClient({ categories }: { categories: Array<{ id: number; name: string; kind: 'fixed' | 'variable' | 'income' }> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded bg-[#8b5cf6] px-3 py-1.5 text-xs font-semibold">+ Nuevo ingreso</button>
      </DialogTrigger>
      <DialogContent className="bg-[#0d0d14] text-white">
        <DialogHeader><DialogTitle>Nuevo ingreso</DialogTitle></DialogHeader>
        <TransactionForm categories={categories} defaultValues={{ type: 'income', currency: 'USD' }} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Visual check**

Run `npm run dev`, go to `/ingresos`, click "+ Nuevo ingreso", fill form, submit. Expected: row appears in table after reload.

- [ ] **Step 4: Commit**

```bash
git add app/ingresos
git commit -m "feat(ingresos): year comparison table + add transaction"
```

---

### Task 5.4: Gastos page with recurrentes pendientes

**Files:**
- Create: `app/gastos/page.tsx`, `app/gastos/GastosClient.tsx`, `lib/queries/gastos.ts`

- [ ] **Step 1: `lib/queries/gastos.ts`**

```typescript
import 'server-only';
import { db } from '@/lib/db';

export async function getPendingRecurring(year: number, month: number) {
  const monthStart = new Date(year, month, 1);
  const nextMonth = new Date(year, month + 1, 1);

  const recurringCats = await db.category.findMany({ where: { isRecurring: true } });
  const alreadyPresent = await db.transaction.findMany({
    where: { type: 'expense', date: { gte: monthStart, lt: nextMonth } },
    select: { categoryId: true },
  });
  const presentIds = new Set(alreadyPresent.map((t) => t.categoryId));

  const pending = [];
  for (const cat of recurringCats) {
    if (presentIds.has(cat.id)) continue;
    const last = await db.transaction.findFirst({
      where: { categoryId: cat.id, type: 'expense' },
      orderBy: { date: 'desc' },
    });
    pending.push({ category: cat, lastAmount: last ? Number(last.amount) : 0, lastCurrency: last?.currency ?? 'ARS' });
  }
  return pending;
}

export async function getExpensesForMonth(year: number, month: number) {
  const monthStart = new Date(year, month, 1);
  const nextMonth = new Date(year, month + 1, 1);
  return db.transaction.findMany({
    where: { type: 'expense', date: { gte: monthStart, lt: nextMonth } },
    include: { category: true },
    orderBy: { date: 'asc' },
  });
}
```

- [ ] **Step 2: `app/gastos/page.tsx`**

```typescript
import { db } from '@/lib/db';
import { getPendingRecurring, getExpensesForMonth } from '@/lib/queries/gastos';
import { GastosClient } from './GastosClient';
import { formatArs } from '@/lib/format';

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const now = new Date();
  const month = m ? Number(m) - 1 : now.getMonth();
  const year = now.getFullYear();
  const [pending, expenses, categories] = await Promise.all([
    getPendingRecurring(year, month),
    getExpensesForMonth(year, month),
    db.category.findMany({ where: { kind: { in: ['fixed', 'variable'] } } }),
  ]);
  const fixed = expenses.filter((e) => e.category.kind === 'fixed');
  const variable = expenses.filter((e) => e.category.kind === 'variable');
  const total = expenses.reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Gastos — {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][month]} {year}</h1>
        <GastosClient categories={categories} pending={pending} year={year} month={month} />
      </div>
      <section>
        <h2 className="mb-2 text-xs uppercase text-[#a1a1aa]">Fijos</h2>
        <table className="w-full text-xs">
          <tbody>
            {fixed.map((e) => (
              <tr key={e.id} className="border-t border-[#17171f]">
                <td className="p-2">{e.category.name}</td>
                <td className="p-2 text-right">{formatArs(Number(e.amount))}</td>
                <td className="p-2 text-right text-[#71717a]">{new Date(e.date).toLocaleDateString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-2 text-xs uppercase text-[#a1a1aa]">Variables</h2>
        <table className="w-full text-xs">
          <tbody>
            {variable.map((e) => (
              <tr key={e.id} className="border-t border-[#17171f]">
                <td className="p-2">{e.category.name}</td>
                <td className="p-2 text-right">{formatArs(Number(e.amount))}</td>
                <td className="p-2 text-right text-[#71717a]">{new Date(e.date).toLocaleDateString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="border-t border-[#1a1a22] pt-3 text-right text-sm font-bold">Total: {formatArs(total)}</div>
    </div>
  );
}
```

- [ ] **Step 3: `app/gastos/GastosClient.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { formatArs } from '@/lib/format';

interface Pending {
  category: { id: number; name: string; kind: 'fixed' | 'variable' | 'income' };
  lastAmount: number;
  lastCurrency: 'USD' | 'ARS';
}

interface Props {
  categories: Array<{ id: number; name: string; kind: 'fixed' | 'variable' | 'income' }>;
  pending: Pending[];
  year: number;
  month: number;
}

export function GastosClient({ categories, pending, year, month }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [adhoc, setAdhoc] = useState(false);
  const active = pending.find((p) => p.category.id === activeCategoryId);
  const dateDefault = new Date(year, month, 15).toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-3">
          <h3 className="mb-2 text-xs uppercase text-[#a78bfa]">📌 Recurrentes pendientes</h3>
          <ul className="space-y-1 text-xs">
            {pending.map((p) => (
              <li key={p.category.id} className="flex items-center justify-between gap-2">
                <span>{p.category.name}</span>
                <span className="text-[#71717a]">Último: {formatArs(p.lastAmount)}</span>
                <button className="rounded bg-[#17171f] px-2 py-1 text-[10px] hover:bg-[#2a2a32]" onClick={() => setActiveCategoryId(p.category.id)}>
                  Agregar ▸
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button className="rounded bg-[#8b5cf6] px-3 py-1.5 text-xs font-semibold" onClick={() => setAdhoc(true)}>+ Nuevo gasto</button>

      <Dialog open={!!activeCategoryId} onOpenChange={(o) => !o && setActiveCategoryId(null)}>
        <DialogContent className="bg-[#0d0d14] text-white">
          <DialogHeader><DialogTitle>{active?.category.name}</DialogTitle></DialogHeader>
          {active && (
            <TransactionForm
              categories={categories}
              defaultValues={{ type: 'expense', currency: active.lastCurrency, amount: active.lastAmount, categoryId: active.category.id, date: dateDefault }}
              onDone={() => setActiveCategoryId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adhoc} onOpenChange={setAdhoc}>
        <DialogContent className="bg-[#0d0d14] text-white">
          <DialogHeader><DialogTitle>Nuevo gasto</DialogTitle></DialogHeader>
          <TransactionForm categories={categories} defaultValues={{ type: 'expense', currency: 'ARS', date: dateDefault }} onDone={() => setAdhoc(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Visual check**

Go to `/gastos`. If there are recurring categories with past transactions not yet in the current month, the pendientes panel appears. Clicking "Agregar" opens a pre-filled form. Edit amount, confirm.

- [ ] **Step 5: Commit**

```bash
git add app/gastos lib/queries/gastos.ts
git commit -m "feat(gastos): monthly view with recurrentes pendientes flow"
```

---

### Task 5.5: Transacciones page (unified history)

**Files:**
- Modify: `app/transacciones/page.tsx`

- [ ] **Step 1: Replace `app/transacciones/page.tsx`**

```typescript
import { db } from '@/lib/db';
import { formatArs, formatUsd } from '@/lib/format';

export default async function TransaccionesPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const { type, q } = await searchParams;
  const rows = await db.transaction.findMany({
    where: {
      type: type === 'income' || type === 'expense' ? type : undefined,
      note: q ? { contains: q } : undefined,
    },
    include: { category: true },
    orderBy: { date: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Transacciones</h1>
        <form className="flex gap-2 text-xs">
          <select name="type" defaultValue={type} className="rounded bg-[#0d0d14] px-2 py-1">
            <option value="">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
          <input name="q" defaultValue={q} placeholder="Buscar..." className="rounded bg-[#0d0d14] px-2 py-1" />
          <button className="rounded bg-[#17171f] px-2 py-1">Filtrar</button>
        </form>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[#a1a1aa]">
          <tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Categoría</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-right">Monto</th><th className="p-2 text-left">Nota</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#17171f]">
              <td className="p-2">{new Date(r.date).toLocaleDateString('es-AR')}</td>
              <td className="p-2">{r.category.name}</td>
              <td className={`p-2 ${r.type === 'income' ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{r.type === 'income' ? 'Ingreso' : 'Gasto'}</td>
              <td className="p-2 text-right">{r.currency === 'USD' ? formatUsd(Number(r.amount)) : formatArs(Number(r.amount))}</td>
              <td className="p-2 text-[#71717a]">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/transacciones/page.tsx
git commit -m "feat(transacciones): unified history with filters"
```

---

## Phase 6 — Investments

### Task 6.1: Asset server actions + page

**Files:**
- Create: `app/actions/assets.ts`, `app/inversiones/page.tsx`, `app/inversiones/InversionesClient.tsx`, `components/forms/AssetForm.tsx`

- [ ] **Step 1: `app/actions/assets.ts`**

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const AssetInput = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  type: z.enum(['cash_usd', 'cash_ars', 'stock', 'crypto', 'property', 'other']),
  quantity: z.coerce.number().positive(),
  ticker: z.string().nullable().optional(),
  priceSource: z.enum(['manual', 'yahoo', 'coingecko']).nullable().optional(),
  manualValue: z.coerce.number().optional(),
  currency: z.enum(['USD', 'ARS']),
});

export async function saveAsset(input: unknown) {
  const parsed = AssetInput.parse(input);
  const data = {
    name: parsed.name, type: parsed.type, quantity: parsed.quantity,
    ticker: parsed.ticker ?? null, priceSource: parsed.priceSource ?? null,
    manualValue: parsed.manualValue ?? null, currency: parsed.currency,
  };
  if (parsed.id) await db.asset.update({ where: { id: parsed.id }, data });
  else await db.asset.create({ data });
  revalidatePath('/inversiones');
  revalidatePath('/patrimonio');
  revalidatePath('/');
}

export async function deleteAsset(id: number) {
  await db.asset.delete({ where: { id } });
  revalidatePath('/inversiones');
  revalidatePath('/patrimonio');
  revalidatePath('/');
}
```

- [ ] **Step 2: `components/forms/AssetForm.tsx`**

```typescript
'use client';

import { useState, useTransition } from 'react';
import { saveAsset } from '@/app/actions/assets';

export function AssetForm({ onDone }: { onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'cash_usd' | 'cash_ars' | 'stock' | 'crypto' | 'property' | 'other'>('cash_usd');
  const needsTicker = type === 'stock' || type === 'crypto';

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = Object.fromEntries(fd.entries());
        startTransition(async () => {
          try {
            await saveAsset(data);
            onDone?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        });
      }}
    >
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Nombre</span>
        <input name="name" required className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" />
      </label>
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Tipo</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white">
          <option value="cash_usd">Efectivo USD</option>
          <option value="cash_ars">Efectivo ARS</option>
          <option value="stock">Acción</option>
          <option value="crypto">Crypto</option>
          <option value="property">Propiedad</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Cantidad</span>
        <input name="quantity" type="number" step="0.00000001" min="0.00000001" required className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" />
      </label>
      <label className="block text-xs">
        <span className="text-[#a1a1aa]">Moneda</span>
        <select name="currency" defaultValue={type === 'cash_ars' ? 'ARS' : 'USD'} className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white">
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
      </label>
      {needsTicker && (
        <>
          <label className="block text-xs">
            <span className="text-[#a1a1aa]">Ticker</span>
            <input name="ticker" placeholder={type === 'crypto' ? 'bitcoin' : 'AAPL'} className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" />
          </label>
          <input type="hidden" name="priceSource" value={type === 'crypto' ? 'coingecko' : 'yahoo'} />
        </>
      )}
      {!needsTicker && (
        <>
          <input type="hidden" name="priceSource" value="manual" />
          <label className="block text-xs">
            <span className="text-[#a1a1aa]">Valor manual</span>
            <input name="manualValue" type="number" step="0.01" min="0" className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" />
          </label>
        </>
      )}
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded bg-[#8b5cf6] py-2 text-xs font-semibold disabled:opacity-50">
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: `app/inversiones/InversionesClient.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AssetForm } from '@/components/forms/AssetForm';

export function InversionesClient() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded bg-[#8b5cf6] px-3 py-1.5 text-xs font-semibold">+ Agregar activo</button>
      </DialogTrigger>
      <DialogContent className="bg-[#0d0d14] text-white">
        <DialogHeader><DialogTitle>Nuevo activo</DialogTitle></DialogHeader>
        <AssetForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: `app/inversiones/page.tsx`**

```typescript
import { db } from '@/lib/db';
import { InversionesClient } from './InversionesClient';
import { formatUsd } from '@/lib/format';

export default async function InversionesPage() {
  const [assets, marketPrices] = await Promise.all([
    db.asset.findMany({ orderBy: { createdAt: 'asc' } }),
    db.marketPrice.findMany({ orderBy: { fetchedAt: 'desc' }, distinct: ['ticker'] }),
  ]);
  const byTicker = new Map(marketPrices.map((p) => [p.ticker, p]));
  const rows = assets.map((a) => {
    const live = a.ticker ? byTicker.get(a.ticker) : undefined;
    const unitPrice = live ? Number(live.price) : Number(a.manualValue ?? 0);
    const totalUsd = a.currency === 'USD' ? unitPrice * Number(a.quantity) : unitPrice; // manual positions store full value
    return { ...a, unitPrice, totalUsd, change24h: live ? Number(live.changePct24h) : 0 };
  });
  const grandTotal = rows.reduce((acc, r) => acc + r.totalUsd, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Inversiones</h1>
        <InversionesClient />
      </div>
      <table className="w-full text-xs">
        <thead className="text-[#a1a1aa]">
          <tr><th className="p-2 text-left">Activo</th><th className="p-2 text-right">Cantidad</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right">Valor</th><th className="p-2 text-right">24h</th><th className="p-2 text-right">%</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#17171f]">
              <td className="p-2">{r.name} <span className="text-[#71717a]">{r.ticker ? `(${r.ticker})` : ''}</span></td>
              <td className="p-2 text-right">{Number(r.quantity)}</td>
              <td className="p-2 text-right">{formatUsd(r.unitPrice)}</td>
              <td className="p-2 text-right">{formatUsd(r.totalUsd)}</td>
              <td className={`p-2 text-right ${r.change24h > 0 ? 'text-[#4ade80]' : r.change24h < 0 ? 'text-[#f87171]' : 'text-[#71717a]'}`}>{r.change24h.toFixed(2)}%</td>
              <td className="p-2 text-right">{grandTotal ? `${Math.round((r.totalUsd / grandTotal) * 100)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Visual check**

`/inversiones` → "+ Agregar activo" → add e.g. "BTC" type "crypto" ticker "bitcoin" quantity "0.5". Save. Verify row appears with live price.

- [ ] **Step 6: Commit**

```bash
git add app/actions/assets.ts components/forms/AssetForm.tsx app/inversiones
git commit -m "feat(inversiones): asset CRUD with live prices"
```

---

## Phase 7 — Patrimonio & Snapshots

### Task 7.1: Liability CRUD

**Files:**
- Create: `app/actions/liabilities.ts`, `components/forms/LiabilityForm.tsx`

- [ ] **Step 1: `app/actions/liabilities.ts`**

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const LiabilityInput = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'ARS']),
  dueDate: z.coerce.date().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function saveLiability(input: unknown) {
  const parsed = LiabilityInput.parse(input);
  const data = { name: parsed.name, amount: parsed.amount, currency: parsed.currency, dueDate: parsed.dueDate ?? null, note: parsed.note ?? null };
  if (parsed.id) await db.liability.update({ where: { id: parsed.id }, data });
  else await db.liability.create({ data });
  revalidatePath('/patrimonio');
  revalidatePath('/');
}

export async function deleteLiability(id: number) {
  await db.liability.delete({ where: { id } });
  revalidatePath('/patrimonio');
  revalidatePath('/');
}
```

- [ ] **Step 2: `components/forms/LiabilityForm.tsx`**

```typescript
'use client';

import { useState, useTransition } from 'react';
import { saveLiability } from '@/app/actions/liabilities';

export function LiabilityForm({ onDone }: { onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget).entries());
        startTransition(async () => {
          try { await saveLiability(data); onDone?.(); }
          catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
        });
      }}
    >
      <label className="block text-xs"><span className="text-[#a1a1aa]">Nombre</span><input name="name" required className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" /></label>
      <label className="block text-xs"><span className="text-[#a1a1aa]">Monto</span><input name="amount" type="number" step="0.01" min="0.01" required className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" /></label>
      <label className="block text-xs"><span className="text-[#a1a1aa]">Moneda</span><select name="currency" className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white"><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
      <label className="block text-xs"><span className="text-[#a1a1aa]">Vencimiento</span><input name="dueDate" type="date" className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" /></label>
      <label className="block text-xs"><span className="text-[#a1a1aa]">Nota</span><input name="note" className="mt-1 block w-full rounded bg-[#0d0d14] px-2 py-1.5 text-white" /></label>
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
      <button disabled={pending} className="w-full rounded bg-[#8b5cf6] py-2 text-xs font-semibold disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar'}</button>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/liabilities.ts components/forms/LiabilityForm.tsx
git commit -m "feat(liabilities): CRUD action + form"
```

---

### Task 7.2: Snapshot generator

**Files:**
- Create: `lib/snapshot.ts`

- [ ] **Step 1: Write `lib/snapshot.ts`**

```typescript
import 'server-only';
import { db } from '@/lib/db';
import { toUsd } from '@/lib/convert';

function isoDateKey(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function ensureTodaySnapshot() {
  const today = isoDateKey(new Date());
  const existing = await db.snapshot.findUnique({ where: { date: today } });
  if (existing) return existing;

  const rate = await db.exchangeRate.findFirst({ where: { type: 'blue' }, orderBy: { fetchedAt: 'desc' } });
  const arsPerUsd = rate ? Number(rate.sellPrice) : 0;

  const [assets, liabilities] = await Promise.all([db.asset.findMany(), db.liability.findMany()]);
  const assetsUsd = assets.reduce((acc, a) => acc + toUsd({ amount: Number(a.manualValue ?? 0), currency: a.currency }, arsPerUsd), 0);
  const liabilitiesUsd = liabilities.reduce((acc, l) => acc + toUsd({ amount: Number(l.amount), currency: l.currency }, arsPerUsd), 0);

  return db.snapshot.create({
    data: {
      date: today,
      assetsUsd,
      liabilitiesUsd,
      netWorthUsd: assetsUsd - liabilitiesUsd,
      exchangeRateUsed: arsPerUsd,
    },
  });
}
```

- [ ] **Step 2: Call it from the Dashboard page**

Modify `app/page.tsx`, at the top of `DashboardPage`:

```typescript
import { ensureTodaySnapshot } from '@/lib/snapshot';
// ...
await ensureTodaySnapshot();
```

- [ ] **Step 3: Commit**

```bash
git add lib/snapshot.ts app/page.tsx
git commit -m "feat(snapshot): daily net-worth snapshot on dashboard load"
```

---

### Task 7.3: Patrimonio page

**Files:**
- Create: `app/patrimonio/page.tsx`, `app/patrimonio/PatrimonioClient.tsx`

- [ ] **Step 1: `app/patrimonio/PatrimonioClient.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LiabilityForm } from '@/components/forms/LiabilityForm';

export function PatrimonioClient() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded bg-[#8b5cf6] px-3 py-1.5 text-xs font-semibold">+ Nueva deuda</button>
      </DialogTrigger>
      <DialogContent className="bg-[#0d0d14] text-white">
        <DialogHeader><DialogTitle>Nueva deuda</DialogTitle></DialogHeader>
        <LiabilityForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: `app/patrimonio/page.tsx`**

```typescript
import { db } from '@/lib/db';
import { AreaChart } from '@/components/dashboard/AreaChart';
import { getNetWorthSeries } from '@/lib/queries/dashboard';
import { formatUsd } from '@/lib/format';
import { PatrimonioClient } from './PatrimonioClient';

export default async function PatrimonioPage() {
  const [snapshots, liabilities] = await Promise.all([getNetWorthSeries(180), db.liability.findMany()]);
  const current = snapshots[snapshots.length - 1];
  const series = snapshots.map((s) => ({ label: s.date.toISOString().slice(5, 10), value: Number(s.netWorthUsd) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Patrimonio</h1>
        <PatrimonioClient />
      </div>
      <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
        <div className="text-[11px] uppercase text-[#a1a1aa]">Patrimonio Neto</div>
        <div className="text-2xl font-bold">{current ? formatUsd(Number(current.netWorthUsd)) : '—'}</div>
      </div>
      <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
        <h2 className="mb-3 text-xs font-semibold">Evolución</h2>
        <AreaChart data={series} />
      </div>
      <section>
        <h2 className="mb-2 text-xs uppercase text-[#a1a1aa]">Deudas</h2>
        <table className="w-full text-xs">
          <tbody>
            {liabilities.map((l) => (
              <tr key={l.id} className="border-t border-[#17171f]">
                <td className="p-2">{l.name}</td>
                <td className="p-2 text-right">{l.currency} {Number(l.amount).toLocaleString('es-AR')}</td>
                <td className="p-2 text-right text-[#71717a]">{l.dueDate ? new Date(l.dueDate).toLocaleDateString('es-AR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/patrimonio
git commit -m "feat(patrimonio): net-worth page with history chart and liabilities"
```

---

## Phase 8 — Excel importer

### Task 8.1: Parser with tests

**Files:**
- Create: `tests/fixtures/sample.xlsx` (hand-crafted during test), `tests/import-excel.test.ts`, `lib/import-excel.ts`

- [ ] **Step 1: Test file — fixture generator helper**

`tests/import-excel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelWorkbook } from '@/lib/import-excel';

function buildWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const income = [
    ['Mes', 'Ingresos 2025', 'Ingresos 2026'],
    ['Enero', 0, 300],
    ['Febrero', 550, 400],
    ['Marzo', 300, 0],
    ['Abril', 300, 150],
  ];
  const incomeWs = XLSX.utils.aoa_to_sheet(income);
  XLSX.utils.book_append_sheet(wb, incomeWs, 'Ingresos');

  const expenses = [
    ['Gasto', 'Enero', 'Febrero', 'Marzo', 'Abril'],
    ['— FIJOS —', '', '', '', ''],
    ['Movistar', 42150, 42150, 42150, 43995.87],
    ['Claude', 30000, 30000, 30000, 30000],
    ['— VARIABLES —', '', '', '', ''],
    ['Uber', 0, 0, 0, 10247],
    ['Juegos', 0, 0, 0, 30000],
  ];
  const expenseWs = XLSX.utils.aoa_to_sheet(expenses);
  XLSX.utils.book_append_sheet(wb, expenseWs, 'Gastos');
  return wb;
}

describe('parseExcelWorkbook', () => {
  it('detects income rows for both years with amount > 0', () => {
    const wb = buildWorkbook();
    const result = parseExcelWorkbook(wb);
    const incomes2025 = result.incomes.filter((i) => i.date.getFullYear() === 2025);
    const incomes2026 = result.incomes.filter((i) => i.date.getFullYear() === 2026);
    expect(incomes2025).toHaveLength(3); // Feb, Mar, Abr (Jan is 0 — skipped)
    expect(incomes2026).toHaveLength(3); // Jan, Feb, Abr (Mar is 0 — skipped)
    expect(incomes2026.find((i) => i.date.getMonth() === 0)?.amount).toBe(300);
  });

  it('detects expense categories and individual rows', () => {
    const wb = buildWorkbook();
    const result = parseExcelWorkbook(wb);
    expect(result.expenseCategories).toEqual(expect.arrayContaining(['Movistar', 'Claude', 'Uber', 'Juegos']));
    expect(result.expenses.length).toBe(10);
    const movistarApr = result.expenses.find((e) => e.categoryName === 'Movistar' && e.date.getMonth() === 3);
    expect(movistarApr?.amount).toBe(43995.87);
  });

  it('skips section separator rows ("— FIJOS —")', () => {
    const wb = buildWorkbook();
    const result = parseExcelWorkbook(wb);
    expect(result.expenses.some((e) => e.categoryName.startsWith('—'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test tests/import-excel.test.ts
```

- [ ] **Step 3: Implement `lib/import-excel.ts`**

```typescript
import * as XLSX from 'xlsx';

export interface ParsedIncome { date: Date; amount: number; year: number }
export interface ParsedExpense { categoryName: string; date: Date; amount: number; kind: 'fixed' | 'variable' }

export interface ParseResult {
  incomes: ParsedIncome[];
  expenses: ParsedExpense[];
  expenseCategories: string[];
  warnings: string[];
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthIndex(label: string): number {
  return MONTHS.indexOf(label.trim().toLowerCase());
}

function toNumber(cell: unknown): number {
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string') {
    const cleaned = cell.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function findIncomeSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | null {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    if (!aoa.length) continue;
    const header = (aoa[0] as string[]).map((h) => String(h ?? '').toLowerCase());
    const hasMes = header.some((h) => h.includes('mes'));
    const hasIngresos = header.some((h) => h.includes('ingreso'));
    if (hasMes && hasIngresos) return ws;
  }
  return null;
}

function findExpenseSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | null {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    if (!aoa.length) continue;
    const header = (aoa[0] as string[]).map((h) => String(h ?? '').toLowerCase());
    const hasGasto = header.some((h) => h.includes('gasto'));
    const monthsFound = header.filter((h) => MONTHS.includes(h.trim())).length;
    if (hasGasto && monthsFound >= 3) return ws;
  }
  return null;
}

export function parseExcelWorkbook(wb: XLSX.WorkBook): ParseResult {
  const warnings: string[] = [];
  const incomes: ParsedIncome[] = [];
  const expenses: ParsedExpense[] = [];
  const expenseCategories: string[] = [];

  const incomeWs = findIncomeSheet(wb);
  if (incomeWs) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(incomeWs, { header: 1, raw: true });
    const header = aoa[0] as string[];
    const yearColumns = header
      .map((h, idx) => ({ idx, year: Number(String(h).match(/\d{4}/)?.[0]) }))
      .filter((c) => c.year > 0);
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] as unknown[];
      const mIdx = monthIndex(String(row[0] ?? ''));
      if (mIdx < 0) continue;
      for (const col of yearColumns) {
        const amount = toNumber(row[col.idx]);
        if (amount > 0) {
          incomes.push({ date: new Date(col.year, mIdx, 1), amount, year: col.year });
        }
      }
    }
  } else {
    warnings.push('No se encontró hoja de ingresos con columnas reconocibles.');
  }

  const expenseWs = findExpenseSheet(wb);
  if (expenseWs) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(expenseWs, { header: 1, raw: true });
    const header = (aoa[0] as string[]).map((h) => String(h ?? ''));
    const monthColumns = header
      .map((h, idx) => ({ idx, m: monthIndex(h) }))
      .filter((c) => c.m >= 0);
    const year = new Date().getFullYear();
    let currentKind: 'fixed' | 'variable' = 'fixed';
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] as unknown[];
      const label = String(row[0] ?? '').trim();
      if (!label) continue;
      if (/fijos/i.test(label)) { currentKind = 'fixed'; continue; }
      if (/variables/i.test(label)) { currentKind = 'variable'; continue; }
      if (label.startsWith('—') || /total/i.test(label)) continue;
      if (!expenseCategories.includes(label)) expenseCategories.push(label);
      for (const col of monthColumns) {
        const amount = toNumber(row[col.idx]);
        if (amount > 0) {
          expenses.push({ categoryName: label, date: new Date(year, col.m, 15), amount, kind: currentKind });
        }
      }
    }
  } else {
    warnings.push('No se encontró hoja de gastos con columnas reconocibles.');
  }

  return { incomes, expenses, expenseCategories, warnings };
}
```

- [ ] **Step 4: Run, confirm all tests pass**

```bash
npm test tests/import-excel.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/import-excel.test.ts lib/import-excel.ts
git commit -m "feat(import): Excel parser with tests"
```

---

### Task 8.2: Import Server Action + UI

**Files:**
- Create: `app/actions/import.ts`, `app/ajustes/ImportarExcelClient.tsx`

- [ ] **Step 1: `app/actions/import.ts`**

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const ImportInput = z.object({
  incomes: z.array(z.object({ date: z.coerce.date(), amount: z.number().positive(), year: z.number() })),
  expenses: z.array(z.object({ categoryName: z.string(), date: z.coerce.date(), amount: z.number().positive(), kind: z.enum(['fixed', 'variable']) })),
  expenseCategories: z.array(z.string()),
  conflictPolicy: z.enum(['replace', 'skip', 'duplicate']).default('skip'),
});

export async function commitImport(input: unknown) {
  const parsed = ImportInput.parse(input);

  const incomeCategory = await db.category.upsert({
    where: { name: 'Ingresos' },
    update: {},
    create: { name: 'Ingresos', kind: 'income', icon: 'trending-up', color: '#4ade80', isRecurring: false },
  });

  const catMap = new Map<string, number>();
  for (const name of parsed.expenseCategories) {
    const existing = await db.category.findUnique({ where: { name } });
    if (existing) {
      catMap.set(name, existing.id);
    } else {
      const created = await db.category.create({
        data: { name, kind: parsed.expenses.find((e) => e.categoryName === name)?.kind ?? 'variable', icon: 'circle', color: '#64748b', isRecurring: false },
      });
      catMap.set(name, created.id);
    }
  }

  const ops: Parameters<typeof db.$transaction>[0] = [];

  if (parsed.conflictPolicy === 'replace') {
    const years = Array.from(new Set(parsed.incomes.map((i) => i.year))).sort();
    for (const y of years) {
      ops.push(db.transaction.deleteMany({
        where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
      }));
    }
  }

  for (const inc of parsed.incomes) {
    ops.push(db.transaction.create({
      data: { date: inc.date, type: 'income', amount: inc.amount, currency: 'USD', categoryId: incomeCategory.id },
    }));
  }
  for (const exp of parsed.expenses) {
    const categoryId = catMap.get(exp.categoryName);
    if (!categoryId) continue;
    ops.push(db.transaction.create({
      data: { date: exp.date, type: 'expense', amount: exp.amount, currency: 'ARS', categoryId },
    }));
  }

  await db.$transaction(ops);
  revalidatePath('/');
  revalidatePath('/ingresos');
  revalidatePath('/gastos');
  revalidatePath('/transacciones');
  revalidatePath('/ajustes');
  return { incomesImported: parsed.incomes.length, expensesImported: parsed.expenses.length };
}
```

- [ ] **Step 2: `app/ajustes/ImportarExcelClient.tsx`**

```typescript
'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { parseExcelWorkbook, type ParseResult } from '@/lib/import-excel';
import { commitImport } from '@/app/actions/import';

export function ImportarExcelClient() {
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [policy, setPolicy] = useState<'replace' | 'skip' | 'duplicate'>('skip');

  return (
    <div className="space-y-3 rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
      <h3 className="text-xs font-semibold uppercase text-[#a1a1aa]">Importar desde Excel</h3>
      <input
        type="file"
        accept=".xlsx"
        className="text-xs"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          const parsed = parseExcelWorkbook(wb);
          setPreview(parsed);
        }}
      />
      {preview && (
        <div className="space-y-2 text-xs">
          <p>✓ {preview.incomes.length} ingresos detectados</p>
          <p>✓ {preview.expenses.length} gastos detectados</p>
          <p>✓ {preview.expenseCategories.length} categorías de gasto</p>
          {preview.warnings.map((w, i) => <p key={i} className="text-[#fb923c]">⚠ {w}</p>)}
          <label className="block text-xs">
            <span className="text-[#a1a1aa]">Si ya existen datos del mismo año:</span>
            <select value={policy} onChange={(e) => setPolicy(e.target.value as typeof policy)} className="mt-1 rounded bg-[#0a0a10] px-2 py-1">
              <option value="skip">Omitir (no pisar)</option>
              <option value="replace">Reemplazar</option>
              <option value="duplicate">Duplicar</option>
            </select>
          </label>
          <button
            onClick={async () => {
              setStatus('Importando…');
              try {
                const result = await commitImport({
                  incomes: preview.incomes.map((i) => ({ ...i, date: i.date.toISOString() })),
                  expenses: preview.expenses.map((e) => ({ ...e, date: e.date.toISOString() })),
                  expenseCategories: preview.expenseCategories,
                  conflictPolicy: policy,
                });
                setStatus(`✓ Importados ${result.incomesImported} ingresos y ${result.expensesImported} gastos.`);
                setPreview(null);
              } catch (err) {
                setStatus(err instanceof Error ? `Error: ${err.message}` : 'Error desconocido');
              }
            }}
            className="rounded bg-[#8b5cf6] px-3 py-1.5 text-xs font-semibold"
          >
            Importar todo
          </button>
        </div>
      )}
      {status && <p className="text-xs">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/import.ts app/ajustes/ImportarExcelClient.tsx
git commit -m "feat(import): Server Action + UI for Excel import"
```

---

## Phase 9 — Reportes (minimal)

### Task 9.1: Basic reportes page

**Files:**
- Modify: `app/reportes/page.tsx`

- [ ] **Step 1: Replace `app/reportes/page.tsx`**

```typescript
import { db } from '@/lib/db';
import { formatArs, formatUsd } from '@/lib/format';

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams;
  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const toDate = to ? new Date(to) : new Date();

  const [income, expense] = await Promise.all([
    db.transaction.aggregate({ where: { type: 'income', date: { gte: fromDate, lte: toDate } }, _sum: { amount: true } }),
    db.transaction.aggregate({ where: { type: 'expense', date: { gte: fromDate, lte: toDate } }, _sum: { amount: true } }),
  ]);
  const totalIncome = Number(income._sum.amount ?? 0);
  const totalExpense = Number(expense._sum.amount ?? 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reportes</h1>
      <form className="flex gap-2 text-xs">
        <label>Desde: <input name="from" type="date" defaultValue={fromDate.toISOString().slice(0, 10)} className="rounded bg-[#0d0d14] px-2 py-1" /></label>
        <label>Hasta: <input name="to" type="date" defaultValue={toDate.toISOString().slice(0, 10)} className="rounded bg-[#0d0d14] px-2 py-1" /></label>
        <button className="rounded bg-[#17171f] px-2 py-1">Generar</button>
      </form>
      <div className="space-y-2">
        <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
          <div className="text-[11px] uppercase text-[#a1a1aa]">Ingresos totales (USD)</div>
          <div className="text-xl font-bold">{formatUsd(totalIncome)}</div>
        </div>
        <div className="rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
          <div className="text-[11px] uppercase text-[#a1a1aa]">Gastos totales (ARS)</div>
          <div className="text-xl font-bold">{formatArs(totalExpense)}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/reportes/page.tsx
git commit -m "feat(reportes): basic date-range report with totals"
```

---

## Phase 10 — Ajustes (ticker config + categories + backup)

### Task 10.1: Ticker config UI

**Files:**
- Create: `app/actions/ticker-items.ts`, `app/ajustes/TickerConfigClient.tsx`

- [ ] **Step 1: `app/actions/ticker-items.ts`**

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const TickerInput = z.object({
  id: z.number().int().optional(),
  displayLabel: z.string().min(1),
  sourceType: z.enum(['fx_ars', 'fx_usd', 'crypto', 'stock', 'index']),
  sourceKey: z.string().min(1),
  orderIndex: z.number().int().min(0),
  isVisible: z.boolean().default(true),
});

export async function saveTickerItem(input: unknown) {
  const parsed = TickerInput.parse(input);
  if (parsed.id) await db.tickerItem.update({ where: { id: parsed.id }, data: parsed });
  else await db.tickerItem.create({ data: parsed });
  revalidatePath('/');
  revalidatePath('/ajustes');
}

export async function deleteTickerItem(id: number) {
  await db.tickerItem.delete({ where: { id } });
  revalidatePath('/');
  revalidatePath('/ajustes');
}

export async function reorderTickerItems(orderedIds: number[]) {
  await db.$transaction(
    orderedIds.map((id, idx) => db.tickerItem.update({ where: { id }, data: { orderIndex: idx } })),
  );
  revalidatePath('/');
  revalidatePath('/ajustes');
}
```

- [ ] **Step 2: `app/ajustes/TickerConfigClient.tsx`**

```typescript
'use client';

import { useState, useTransition } from 'react';
import { saveTickerItem, deleteTickerItem, reorderTickerItems } from '@/app/actions/ticker-items';

interface Item {
  id: number;
  displayLabel: string;
  sourceType: 'fx_ars' | 'fx_usd' | 'crypto' | 'stock' | 'index';
  sourceKey: string;
  orderIndex: number;
  isVisible: boolean;
}

export function TickerConfigClient({ items: initialItems }: { items: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const moveUp = (i: number) => {
    if (i <= 0) return;
    const copy = [...items];
    [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
    setItems(copy);
    startTransition(() => { reorderTickerItems(copy.map((x) => x.id)); });
  };
  const moveDown = (i: number) => {
    if (i >= items.length - 1) return;
    const copy = [...items];
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
    setItems(copy);
    startTransition(() => { reorderTickerItems(copy.map((x) => x.id)); });
  };

  return (
    <div className="space-y-3 rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-[#a1a1aa]">Configurar Ticker</h3>
        <button className="rounded bg-[#8b5cf6] px-2 py-1 text-[10px]" onClick={() => setAdding(true)}>+ Agregar</button>
      </div>
      <ul className="divide-y divide-[#17171f] text-xs">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2 py-2">
            <div className="flex flex-col">
              <button className="text-[#71717a] hover:text-white" onClick={() => moveUp(i)}>▲</button>
              <button className="text-[#71717a] hover:text-white" onClick={() => moveDown(i)}>▼</button>
            </div>
            <span className="flex-1">{it.displayLabel} <span className="text-[#71717a]">· {it.sourceType} · {it.sourceKey}</span></span>
            <button
              className="text-[#f87171] hover:text-white"
              onClick={() => startTransition(async () => { await deleteTickerItem(it.id); setItems(items.filter((x) => x.id !== it.id)); })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {adding && (
        <form
          className="space-y-2 border-t border-[#17171f] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const data = {
              displayLabel: String(fd.get('displayLabel')),
              sourceType: String(fd.get('sourceType')),
              sourceKey: String(fd.get('sourceKey')),
              orderIndex: items.length,
              isVisible: true,
            };
            startTransition(async () => {
              await saveTickerItem(data);
              setAdding(false);
              location.reload();
            });
          }}
        >
          <input name="displayLabel" placeholder="Etiqueta (ej: ETH/USD)" required className="w-full rounded bg-[#0a0a10] px-2 py-1 text-xs" />
          <select name="sourceType" className="w-full rounded bg-[#0a0a10] px-2 py-1 text-xs">
            <option value="crypto">Crypto</option>
            <option value="stock">Acción</option>
            <option value="index">Índice</option>
            <option value="fx_ars">FX vs ARS</option>
            <option value="fx_usd">FX vs USD</option>
          </select>
          <input name="sourceKey" placeholder="ID / Ticker / casa" required className="w-full rounded bg-[#0a0a10] px-2 py-1 text-xs" />
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-[#8b5cf6] px-2 py-1 text-[10px]">Guardar</button>
            <button type="button" className="rounded bg-[#17171f] px-2 py-1 text-[10px]" onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/ticker-items.ts app/ajustes/TickerConfigClient.tsx
git commit -m "feat(ajustes): ticker configuration UI"
```

---

### Task 10.2: Backup & restore

**Files:**
- Create: `app/actions/backup.ts`, `app/ajustes/BackupClient.tsx`, `app/api/backup/download/route.ts`

- [ ] **Step 1: `app/api/backup/download/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  const dbPath = path.resolve(process.cwd(), 'finanzas.db');
  const file = await readFile(dbPath);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="finanzas-${new Date().toISOString().slice(0, 10)}.db"`,
    },
  });
}
```

- [ ] **Step 2: `app/actions/backup.ts`**

```typescript
'use server';

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';

export async function restoreBackup(formData: FormData) {
  const file = formData.get('file');
  if (!(file instanceof File)) throw new Error('No file');
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.resolve(process.cwd(), 'finanzas.db'), buf);
  revalidatePath('/');
}
```

- [ ] **Step 3: `app/ajustes/BackupClient.tsx`**

```typescript
'use client';

import { useTransition, useState } from 'react';
import { restoreBackup } from '@/app/actions/backup';

export function BackupClient() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-3 rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
      <h3 className="text-xs font-semibold uppercase text-[#a1a1aa]">Backup / Restore</h3>
      <a href="/api/backup/download" className="inline-block rounded bg-[#17171f] px-3 py-1.5 text-xs">Descargar backup</a>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try { await restoreBackup(fd); setMsg('✓ Restaurado. Recarga la página.'); }
            catch (err) { setMsg(err instanceof Error ? err.message : 'Error'); }
          });
        }}
        className="flex items-center gap-2"
      >
        <input type="file" name="file" accept=".db" required className="text-xs" />
        <button disabled={pending} className="rounded bg-[#f87171] px-3 py-1.5 text-xs text-white disabled:opacity-50">
          {pending ? 'Restaurando…' : 'Restaurar'}
        </button>
      </form>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/backup.ts app/ajustes/BackupClient.tsx app/api/backup
git commit -m "feat(ajustes): backup download and restore"
```

---

### Task 10.3: Wire up Ajustes page

**Files:**
- Modify: `app/ajustes/page.tsx`

- [ ] **Step 1: Replace `app/ajustes/page.tsx`**

```typescript
import { db } from '@/lib/db';
import { ImportarExcelClient } from './ImportarExcelClient';
import { TickerConfigClient } from './TickerConfigClient';
import { BackupClient } from './BackupClient';
import { updateDefaultRate } from '@/app/actions/settings';

export default async function AjustesPage() {
  const [tickerItems, setting] = await Promise.all([
    db.tickerItem.findMany({ orderBy: { orderIndex: 'asc' } }),
    db.setting.findUnique({ where: { key: 'default_rate_type' } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ajustes</h1>
      <form action={updateDefaultRate} className="space-y-3 rounded-xl border border-[#1a1a22] bg-[#0d0d14] p-4">
        <h3 className="text-xs font-semibold uppercase text-[#a1a1aa]">Cotización default</h3>
        <select name="value" defaultValue={setting?.value ?? 'blue'} className="rounded bg-[#0a0a10] px-2 py-1 text-xs">
          <option value="blue">Blue</option>
          <option value="oficial">Oficial</option>
          <option value="mep">MEP</option>
          <option value="ccl">CCL</option>
          <option value="usdt">USDT</option>
        </select>
        <button className="ml-2 rounded bg-[#8b5cf6] px-3 py-1 text-xs">Guardar</button>
      </form>
      <TickerConfigClient items={tickerItems} />
      <ImportarExcelClient />
      <BackupClient />
    </div>
  );
}
```

- [ ] **Step 2: Create `app/actions/settings.ts`**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function updateDefaultRate(formData: FormData) {
  const value = String(formData.get('value') ?? 'blue');
  await db.setting.upsert({
    where: { key: 'default_rate_type' },
    update: { value },
    create: { key: 'default_rate_type', value },
  });
  revalidatePath('/');
  revalidatePath('/ajustes');
}
```

- [ ] **Step 3: Visual check**

Go to `/ajustes`. Expected: default rate dropdown, ticker config, Excel import and backup blocks all render and are interactive.

- [ ] **Step 4: Commit**

```bash
git add app/ajustes/page.tsx app/actions/settings.ts
git commit -m "feat(ajustes): wire up settings page with all blocks"
```

---

## Phase 11 — Final integration check

### Task 11.1: End-to-end smoke test (manual)

- [ ] **Step 1: Fresh DB check**

```bash
rm finanzas.db
npx prisma db push
npm run db:seed
npm run dev
```

Expected: app loads at `localhost:3000` with empty dashboard and seeded categories/ticker.

- [ ] **Step 2: Manual smoke test**

Execute this checklist in order, stopping at any failure:

1. `/` — dashboard renders. Ticker populates within 10s with 6 items. KPIs show 0 (no data).
2. `/ajustes` → "Importar desde Excel" → upload user's real Excel file → preview shows detected rows → click "Importar todo" → message confirms count.
3. `/` — dashboard now shows non-zero KPIs, charts have data.
4. `/ingresos` — comparison table populated, chart renders.
5. `/gastos` — month view shows imported fixed+variable expenses. If the current month has recurring categories not yet imported, "Recurrentes pendientes" appears.
6. `/inversiones` → "+ Agregar activo" → add a test crypto (name: "Bitcoin", type: crypto, ticker: "bitcoin", quantity: 0.01, currency: USD). Reload → row appears with live price.
7. `/patrimonio` — net worth KPI shows value (0 until at least one asset is added). History chart populates after first snapshot.
8. `/ajustes` → change default rate to "Oficial" → save → return to `/` → verify ARS-denominated values change accordingly.
9. `/ajustes` → download backup → restore same file → app should work identically.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass (dolarapi, coingecko, yahoo, frankfurter, convert, import-excel).

- [ ] **Step 4: Commit any last fixes**

If any test or manual step failed, fix and commit. Otherwise:

```bash
git log --oneline
```

---

## Self-review notes

Coverage check against spec sections:

| Spec § | Task(s) |
|---|---|
| 2. Arquitectura | Phase 0 (scaffold), Phase 1 (DB) |
| 3.1 Transaction | Tasks 1.1, 5.1, 5.3, 5.4, 5.5 |
| 3.2 Category | Tasks 1.1, 1.2, 5.1 |
| 3.3 Asset | Tasks 1.1, 6.1 |
| 3.4 Liability | Tasks 1.1, 7.1 |
| 3.5 ExchangeRate | Task 1.1, Phase 2 |
| 3.6 MarketPrice | Task 1.1, Phase 2 |
| 3.7 Snapshot | Task 1.1, 7.2 |
| 3.8 TickerItem | Task 1.1, 1.2, 10.1 |
| 3.9 Setting | Task 1.1, 1.2, 10.3 |
| 4.1 Dashboard | Phase 4 |
| 4.2 Transacciones | Task 5.5 |
| 4.3 Ingresos | Task 5.3 |
| 4.4 Gastos | Task 5.4 |
| 4.5 Inversiones | Task 6.1 |
| 4.6 Patrimonio | Task 7.3 |
| 4.7 Reportes | Task 9.1 |
| 4.8 Ajustes | Task 10.1, 10.2, 10.3 |
| 5. Cotizaciones/precios | Phase 2 |
| 6. Importación | Phase 8 |
| 7. Diseño visual | Task 3.1, Phase 4 |
| 8. Consideraciones técnicas | Threaded throughout |

No placeholders, types are consistent (`Currency` used everywhere, `RateType` used in both Prisma schema and API routes).
