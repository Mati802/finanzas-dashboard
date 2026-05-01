import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import type { AssetType, Currency, TransactionType } from '@/lib/types';

// ---------- Public types ----------

export interface ParsedTransaction {
  date: Date;
  type: TransactionType;
  amount: number; // positive
  currency: Currency;
  categoryName: string; // may be new
  isRecurring: boolean; // inferred from sheet ("fijos")
  note?: string;
}

export interface ParsedAsset {
  name: string;
  type: AssetType;
  quantity: number;
  ticker?: string;
  currency: Currency;
  manualValue?: number;
}

export interface ParsedWorkbook {
  transactions: ParsedTransaction[];
  assets: ParsedAsset[];
  warnings: string[];
}

// ---------- Helpers ----------

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Normalize a string: lowercase, trim, strip accents. */
function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function monthIndex(label: unknown): number {
  const n = norm(label);
  // Exact month names first
  const direct = MONTHS.indexOf(n as (typeof MONTHS)[number]);
  if (direct >= 0) return direct;
  // Contains a month name (e.g. "enero 2026")
  for (let i = 0; i < MONTHS.length; i++) {
    if (n.includes(MONTHS[i])) return i;
  }
  return -1;
}

/**
 * Parse a cell into a positive finite number.
 * Supports Excel numeric cells, plain strings, and ARS-style formats like
 * "$1.234,56", "USD 120", "ARS -42,5". Returns null when value is not numeric.
 */
function parseNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? cell : null;
  }
  if (typeof cell === 'boolean') return null;
  if (cell instanceof Date) return null;
  const raw = String(cell).trim();
  if (!raw) return null;
  // Strip currency prefixes/symbols
  const stripped = raw.replace(/(usd|ars|u\$s|us\$|\$|€)/gi, '').trim();
  // Keep digits, separators, and sign
  const onlyNumLike = stripped.replace(/[^0-9,.\-]/g, '');
  if (!onlyNumLike) return null;

  // Heuristic to normalize decimal separator:
  // - If string has both "," and ".", the LAST one is the decimal separator.
  // - If only one is present, treat "," as decimal (es-AR) unless it looks like thousands (e.g. "1,234").
  let normalized = onlyNumLike;
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    // Only commas. If followed by exactly 3 digits and no other comma -> thousands.
    const afterComma = normalized.slice(lastComma + 1);
    const commaCount = (normalized.match(/,/g) ?? []).length;
    if (commaCount === 1 && afterComma.length === 3 && /^\d{3}$/.test(afterComma)) {
      normalized = normalized.replace(',', '');
    } else {
      normalized = normalized.replace(/,/g, '.');
    }
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Detect the currency signalled by a header or cell value. */
function detectCurrencyHint(...values: unknown[]): Currency | null {
  for (const v of values) {
    const s = norm(v);
    if (!s) continue;
    if (/\busd\b|u\$s|us\$|dolar|dolares/.test(s)) return 'USD';
    if (/\bars\b|pesos|peso arg|arg\$/.test(s)) return 'ARS';
  }
  return null;
}

/** Parse a 4-digit year from a header cell. */
function parseYearFromHeader(value: unknown): number | null {
  const s = String(value ?? '');
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

function sheetAoa(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
}

function toArrayBuffer(buf: ArrayBuffer | Buffer | Uint8Array): ArrayBuffer {
  if (buf instanceof ArrayBuffer) return buf;
  if (typeof Buffer !== 'undefined' && buf instanceof Buffer) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  if (buf instanceof Uint8Array) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  return buf as ArrayBuffer;
}

// ---------- Sheet classifiers ----------

type SheetRole = 'income' | 'expense-fixed' | 'expense-variable' | 'assets' | 'unknown';

function classifySheet(name: string, aoa: unknown[][]): SheetRole {
  const n = norm(name);
  const header = (aoa[0] ?? []).map((h) => norm(h));
  const headerText = header.join(' ');

  // Assets: inversiones / activos / portfolio
  if (/inversion|inversio|activo|portfolio/.test(n)) return 'assets';
  // Fixed expenses
  if (/gasto.*fijo|fijo.*gasto|fijos/.test(n)) return 'expense-fixed';
  // Variable expenses
  if (/gasto.*variable|variable.*gasto|variables/.test(n)) return 'expense-variable';
  // Generic gastos sheet -> treat as expense (with inline fixed/variable headers)
  if (/gasto/.test(n)) return 'expense-variable';
  // Income
  if (/ingreso|income/.test(n)) return 'income';

  // Fallback: try to detect by structure
  if (/tipo/.test(headerText) && /cantidad|ticker|moneda/.test(headerText)) return 'assets';
  const monthsFound = header.filter((h) => monthIndex(h) >= 0).length;
  if (monthsFound >= 3 && /ingreso/.test(headerText)) return 'income';
  if (monthsFound >= 3) return 'expense-variable';

  return 'unknown';
}

// ---------- Parsers per sheet role ----------

function parseIncomeSheet(
  sheetName: string,
  aoa: unknown[][],
  warnings: string[]
): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  if (aoa.length < 2) return out;
  const header = aoa[0];
  const sheetCurrencyHint = detectCurrencyHint(sheetName, ...header);

  // Two possible layouts:
  //  A) months in rows, years in columns  (header row has year numbers)
  //  B) years in rows, months in columns  (header row has month names)
  const yearCols: { idx: number; year: number; currency: Currency }[] = [];
  const monthCols: { idx: number; m: number }[] = [];
  for (let i = 1; i < header.length; i++) {
    const h = header[i];
    const y = parseYearFromHeader(h);
    if (y) {
      const c = detectCurrencyHint(h) ?? sheetCurrencyHint ?? 'USD';
      yearCols.push({ idx: i, year: y, currency: c });
    }
    const m = monthIndex(h);
    if (m >= 0) monthCols.push({ idx: i, m });
  }

  if (yearCols.length > 0) {
    // Layout A: rows = months
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const mIdx = monthIndex(row[0]);
      if (mIdx < 0) continue;
      for (const col of yearCols) {
        const rawCell = row[col.idx];
        if (rawCell === null || rawCell === undefined || rawCell === '') continue;
        const amount = parseNumber(rawCell);
        if (amount === null) {
          warnings.push(
            `Ingresos: no se pudo interpretar el monto "${String(rawCell)}" en ${MONTHS[mIdx]} ${col.year}`
          );
          continue;
        }
        if (amount <= 0) continue;
        out.push({
          date: new Date(col.year, mIdx, 1),
          type: 'income',
          amount,
          currency: col.currency,
          categoryName: 'Ingresos',
          isRecurring: false,
        });
      }
    }
    return out;
  }

  if (monthCols.length > 0) {
    // Layout B: rows have year labels and one number per month
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const year = parseYearFromHeader(row[0]) ?? Number(row[0]);
      if (!Number.isFinite(year) || year < 1900) continue;
      for (const col of monthCols) {
        const amount = parseNumber(row[col.idx]);
        if (amount === null || amount <= 0) continue;
        out.push({
          date: new Date(year, col.m, 1),
          type: 'income',
          amount,
          currency: sheetCurrencyHint ?? 'USD',
          categoryName: 'Ingresos',
          isRecurring: false,
        });
      }
    }
  }

  return out;
}

function parseExpenseSheet(
  sheetName: string,
  aoa: unknown[][],
  defaultRecurring: boolean,
  warnings: string[]
): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  if (aoa.length < 2) return out;
  const header = aoa[0];
  const sheetCurrencyHint = detectCurrencyHint(sheetName, ...header) ?? 'ARS';

  // Columns that are months; per-column currency override if header mentions one.
  const monthCols: { idx: number; m: number; currency: Currency }[] = [];
  for (let i = 1; i < header.length; i++) {
    const m = monthIndex(header[i]);
    if (m < 0) continue;
    const hintedCurrency = detectCurrencyHint(header[i]) ?? sheetCurrencyHint;
    monthCols.push({ idx: i, m, currency: hintedCurrency });
  }
  if (monthCols.length === 0) return out;

  const year = new Date().getFullYear();
  let currentKind: 'fixed' | 'variable' = defaultRecurring ? 'fixed' : 'variable';

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const label = String(row[0] ?? '').trim();
    if (!label) continue;

    // In-sheet section markers (e.g. "— FIJOS —" or "— VARIABLES —")
    if (/fijos/i.test(label)) {
      currentKind = 'fixed';
      continue;
    }
    if (/variables/i.test(label)) {
      currentKind = 'variable';
      continue;
    }
    if (label.startsWith('—') || /^total/i.test(label)) continue;

    for (const col of monthCols) {
      const rawCell = row[col.idx];
      if (rawCell === null || rawCell === undefined || rawCell === '') continue;
      const amount = parseNumber(rawCell);
      if (amount === null) {
        warnings.push(
          `${sheetName}: no se pudo interpretar el monto "${String(rawCell)}" para "${label}" (${MONTHS[col.m]})`
        );
        continue;
      }
      if (amount <= 0) continue;
      out.push({
        date: new Date(year, col.m, 15),
        type: 'expense',
        amount,
        currency: col.currency,
        categoryName: label,
        isRecurring: currentKind === 'fixed',
      });
    }
  }

  return out;
}

function parseAssetsSheet(
  sheetName: string,
  aoa: unknown[][],
  warnings: string[]
): ParsedAsset[] {
  const out: ParsedAsset[] = [];
  if (aoa.length < 2) return out;
  const header = (aoa[0] ?? []).map((h) => norm(h));

  // Find column indexes by fuzzy header matching.
  const findCol = (...patterns: RegExp[]): number => {
    for (let i = 0; i < header.length; i++) {
      for (const p of patterns) if (p.test(header[i])) return i;
    }
    return -1;
  };
  const nameIdx = findCol(/^nombre$|^name$|^activo$/);
  const typeIdx = findCol(/^tipo$|^type$/);
  const qtyIdx = findCol(/cantidad|quantity|qty/);
  const tickerIdx = findCol(/ticker|simbolo|s[ií]mbolo/);
  const currencyIdx = findCol(/moneda|currency/);
  const manualIdx = findCol(/manual|valor/);

  if (nameIdx < 0) return out;

  const validTypes: AssetType[] = ['cash_usd', 'cash_ars', 'stock', 'crypto', 'property', 'other'];

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const name = String(row[nameIdx] ?? '').trim();
    if (!name) continue;

    const rawType = norm(row[typeIdx] ?? '').replace(/\s+/g, '_');
    let type: AssetType = 'other';
    if ((validTypes as string[]).includes(rawType)) {
      type = rawType as AssetType;
    } else if (/cripto|crypto|btc|eth/.test(rawType)) {
      type = 'crypto';
    } else if (/accion|stock|acci[oó]n/.test(rawType)) {
      type = 'stock';
    } else if (/propiedad|property|inmueble/.test(rawType)) {
      type = 'property';
    } else if (/efectivo.*usd|cash.*usd|dolar|d[oó]lares/.test(rawType)) {
      type = 'cash_usd';
    } else if (/efectivo.*ars|cash.*ars|peso/.test(rawType)) {
      type = 'cash_ars';
    } else if (rawType) {
      warnings.push(`${sheetName}: tipo de activo "${rawType}" no reconocido, usando "other" para "${name}"`);
    }

    const quantity = qtyIdx >= 0 ? parseNumber(row[qtyIdx]) ?? 0 : 0;
    const tickerRaw = tickerIdx >= 0 ? String(row[tickerIdx] ?? '').trim() : '';
    const currency = detectCurrencyHint(row[currencyIdx]) ?? (type === 'cash_ars' ? 'ARS' : 'USD');
    const manualValue = manualIdx >= 0 ? parseNumber(row[manualIdx]) : null;

    out.push({
      name,
      type,
      quantity,
      ticker: tickerRaw || undefined,
      currency,
      manualValue: manualValue !== null && manualValue > 0 ? manualValue : undefined,
    });
  }

  return out;
}

// ---------- Entry points ----------

export function parseFinanzasWorkbook(
  buf: ArrayBuffer | Buffer | Uint8Array
): ParsedWorkbook {
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const assets: ParsedAsset[] = [];

  let wb: XLSX.WorkBook;
  try {
    const ab = toArrayBuffer(buf);
    wb = XLSX.read(ab, { type: 'array', cellDates: true });
  } catch (err) {
    return {
      transactions,
      assets,
      warnings: [`No se pudo leer el archivo Excel: ${(err as Error).message}`],
    };
  }

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = sheetAoa(ws);
    if (!aoa.length) continue;
    const role = classifySheet(name, aoa);
    switch (role) {
      case 'income':
        transactions.push(...parseIncomeSheet(name, aoa, warnings));
        break;
      case 'expense-fixed':
        transactions.push(...parseExpenseSheet(name, aoa, true, warnings));
        break;
      case 'expense-variable':
        transactions.push(...parseExpenseSheet(name, aoa, false, warnings));
        break;
      case 'assets':
        assets.push(...parseAssetsSheet(name, aoa, warnings));
        break;
      default:
        // Skip silently
        break;
    }
  }

  return { transactions, assets, warnings };
}

// ---------- Persistence ----------

/**
 * Persist a parsed workbook to the DB. Uses category upsert so repeated
 * imports don't duplicate categories. Returns counts for the UI to display.
 */
export async function applyParsedWorkbook(
  parsed: ParsedWorkbook
): Promise<{ transactions: number; assets: number; newCategories: number }> {
  // Upsert categories first so every transaction has a valid categoryId.
  const categoryCache = new Map<string, number>();
  let newCategories = 0;

  // Collect unique category names with inferred kind.
  const categoryKinds = new Map<string, 'fixed' | 'variable' | 'income'>();
  for (const t of parsed.transactions) {
    if (!categoryKinds.has(t.categoryName)) {
      const kind = t.type === 'income' ? 'income' : t.isRecurring ? 'fixed' : 'variable';
      categoryKinds.set(t.categoryName, kind);
    }
  }

  for (const [name, kind] of categoryKinds) {
    const existing = await db.category.findUnique({ where: { name } });
    if (existing) {
      categoryCache.set(name, existing.id);
    } else {
      const created = await db.category.create({
        data: {
          name,
          kind,
          icon: kind === 'income' ? 'trending-up' : 'circle',
          color: kind === 'income' ? '#4ade80' : '#64748b',
          isRecurring: kind === 'fixed',
        },
      });
      categoryCache.set(name, created.id);
      newCategories += 1;
    }
  }

  let txCount = 0;
  for (const t of parsed.transactions) {
    const categoryId = categoryCache.get(t.categoryName);
    if (!categoryId) continue;
    await db.transaction.create({
      data: {
        date: t.date,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        categoryId,
        note: t.note,
      },
    });
    txCount += 1;
  }

  let assetCount = 0;
  for (const a of parsed.assets) {
    await db.asset.create({
      data: {
        name: a.name,
        type: a.type,
        quantity: a.quantity,
        ticker: a.ticker,
        currency: a.currency,
        manualValue: a.manualValue,
        priceSource: a.manualValue !== undefined ? 'manual' : undefined,
      },
    });
    assetCount += 1;
  }

  return { transactions: txCount, assets: assetCount, newCategories };
}
