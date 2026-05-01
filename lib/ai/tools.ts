import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { generateDailySnapshot } from '@/lib/snapshot';
import { fetchCryptoPrices } from '@/lib/rates';
import { ASSET_TYPES } from '@/lib/types';

/**
 * Herramientas que el asistente puede invocar para ver y modificar datos.
 * Cada tool tiene:
 *  - definition: el JSON Schema que mandamos a Claude.
 *  - execute(input): lo que corre en el servidor cuando Claude la invoca.
 *
 * Diseño:
 *  - Todas devuelven objetos JSON-serializables (se mandan de vuelta como `tool_result`).
 *  - Errores se devuelven como `{ error: string }` en vez de throw — así Claude
 *    puede reaccionar (ej. "no existe esa categoría, ¿querés que la cree?").
 *  - Las acciones de escritura devuelven un `ToolActionSummary` que la UI muestra
 *    como un "chip" abajo del mensaje del asistente.
 */

export interface ToolActionSummary {
  tool: string;
  /** Texto humano listo para mostrar: "Creé la categoría 'Supermercado'". */
  label: string;
  /** Opcional: id de la fila creada/modificada. */
  entityId?: number;
}

export interface ToolResult {
  ok: boolean;
  /** Datos para que Claude los lea. */
  data?: unknown;
  /** Mensaje de error para que Claude decida qué hacer. */
  error?: string;
  /** Se agrega a la lista de acciones del mensaje del asistente. */
  action?: ToolActionSummary;
}

type JsonSchema = Record<string, unknown>;

export interface ToolDef {
  name: string;
  description: string;
  input_schema: JsonSchema;
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

// ------- Helpers ---------------------------------------------------------

function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  return String(v);
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

function parseDateYmd(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  // Aceptamos "YYYY-MM-DD" o ISO completo. Normalizamos a mediodía UTC para
  // evitar que el cambio de zona horaria mueva la fecha al día anterior.
  const m = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) {
    const d = new Date(m[0] + 'T12:00:00.000Z');
    return Number.isNaN(d.getTime()) ? fallback : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// ------- Tools -----------------------------------------------------------

const listCategoriesTool: ToolDef = {
  name: 'list_categories',
  description:
    'Lista todas las categorías disponibles para transacciones, con su tipo (fixed/variable/income). Usala antes de crear una transacción para decidir la categoría correcta o para saber si hace falta crear una nueva.',
  input_schema: { type: 'object', properties: {}, additionalProperties: false },
  async execute() {
    const cats = await db.category.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
    return {
      ok: true,
      data: cats.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        icon: c.icon,
        color: c.color,
        isRecurring: c.isRecurring,
      })),
    };
  },
};

const createCategoryTool: ToolDef = {
  name: 'create_category',
  description:
    'Crea una categoría nueva. Usala cuando quieras registrar una transacción y la categoría apropiada no existe en list_categories. Devuelve un error si ya hay una con el mismo nombre (en ese caso usá la existente).',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nombre visible, ej. "Supermercado", "Streaming".' },
      kind: {
        type: 'string',
        enum: ['fixed', 'variable', 'income'],
        description:
          'fixed = gasto recurrente (alquiler, internet); variable = gasto ocasional; income = ingreso.',
      },
      icon: {
        type: 'string',
        description: 'Nombre de ícono lucide sugerido (ej. "shopping-cart", "film"). Default "tag".',
      },
      color: {
        type: 'string',
        description: 'Color hex (ej. "#10b981"). Default un gris neutro.',
      },
      isRecurring: { type: 'boolean', description: 'true si es un gasto fijo mensual.' },
    },
    required: ['name', 'kind'],
    additionalProperties: false,
  },
  async execute(input) {
    const name = str(input.name).trim();
    const kind = str(input.kind, 'variable');
    if (!name) return { ok: false, error: 'name es requerido' };
    if (!['fixed', 'variable', 'income'].includes(kind)) {
      return { ok: false, error: 'kind inválido' };
    }
    const existing = await db.category.findUnique({ where: { name } });
    if (existing) {
      return {
        ok: false,
        error: `Ya existe una categoría llamada "${name}" (id=${existing.id}). Reutilizala.`,
        data: { id: existing.id, name: existing.name, kind: existing.kind },
      };
    }
    const created = await db.category.create({
      data: {
        name,
        kind,
        icon: str(input.icon, 'tag') || 'tag',
        color: str(input.color, '#71717a') || '#71717a',
        isRecurring: bool(input.isRecurring, kind === 'fixed'),
      },
    });
    return {
      ok: true,
      data: { id: created.id, name: created.name, kind: created.kind },
      action: {
        tool: 'create_category',
        label: `Creé la categoría "${created.name}" (${created.kind})`,
        entityId: created.id,
      },
    };
  },
};

const createTransactionTool: ToolDef = {
  name: 'create_transaction',
  description:
    'Registra un gasto o ingreso. Podés indicar la categoría por id (categoryId) o por nombre (categoryName). Si pasás categoryName y no existe la categoría, devuelve error — creala primero con create_category. La fecha es opcional (default hoy). Moneda por defecto USD.',
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['income', 'expense'] },
      amount: { type: 'number', description: 'Monto positivo (sin signo). Ej. 12500.' },
      currency: { type: 'string', enum: ['USD', 'ARS'], description: 'Moneda del monto.' },
      categoryId: { type: 'number', description: 'Id de la categoría si ya la conocés.' },
      categoryName: {
        type: 'string',
        description: 'Alternativa a categoryId — nombre exacto (case-sensitive).',
      },
      date: {
        type: 'string',
        description: 'Fecha YYYY-MM-DD. Si no se indica, se usa la fecha de hoy.',
      },
      note: { type: 'string', description: 'Descripción opcional (ej. "Café Starbucks Palermo").' },
    },
    required: ['type', 'amount', 'currency'],
    additionalProperties: false,
  },
  async execute(input) {
    const type = str(input.type);
    if (type !== 'income' && type !== 'expense') {
      return { ok: false, error: 'type debe ser "income" o "expense"' };
    }
    const amount = num(input.amount);
    if (amount <= 0) return { ok: false, error: 'amount debe ser positivo' };
    const currency = str(input.currency);
    if (currency !== 'USD' && currency !== 'ARS') {
      return { ok: false, error: 'currency debe ser USD o ARS' };
    }

    // Resolver categoría por id o nombre.
    let categoryId = num(input.categoryId, 0);
    let categoryName = str(input.categoryName).trim();
    if (!categoryId && categoryName) {
      const cat = await db.category.findUnique({ where: { name: categoryName } });
      if (!cat) {
        return {
          ok: false,
          error: `No existe categoría "${categoryName}". Creala antes con create_category o usá list_categories para ver las disponibles.`,
        };
      }
      categoryId = cat.id;
    }
    if (!categoryId) {
      return { ok: false, error: 'Tenés que pasar categoryId o categoryName.' };
    }
    const cat = await db.category.findUnique({ where: { id: categoryId } });
    if (!cat) return { ok: false, error: `Categoría id=${categoryId} no encontrada.` };
    categoryName = cat.name;

    // Validación de consistencia: ingresos a categorías 'income', gastos a 'fixed'/'variable'.
    if (type === 'income' && cat.kind !== 'income') {
      return {
        ok: false,
        error: `La categoría "${cat.name}" es de tipo ${cat.kind}, no sirve para ingresos. Usá otra o creá una de kind=income.`,
      };
    }
    if (type === 'expense' && cat.kind === 'income') {
      return {
        ok: false,
        error: `La categoría "${cat.name}" es de ingresos; no podés usarla para un gasto.`,
      };
    }

    const date = parseDateYmd(str(input.date) || undefined, new Date());
    const note = str(input.note).trim() || null;

    const created = await db.transaction.create({
      data: { date, type, amount, currency, categoryId, note },
    });
    await generateDailySnapshot().catch(() => {});

    const signed = type === 'expense' ? -amount : amount;
    const fmtMoney = `${currency === 'USD' ? 'US$' : 'AR$'}${amount.toLocaleString('es-AR')}`;
    return {
      ok: true,
      data: { id: created.id, amount: signed, currency, categoryName },
      action: {
        tool: 'create_transaction',
        label: `Registré ${type === 'expense' ? 'gasto' : 'ingreso'} de ${fmtMoney} en "${categoryName}"`,
        entityId: created.id,
      },
    };
  },
};

const listAssetsTool: ToolDef = {
  name: 'list_assets',
  description: 'Lista los activos actuales del usuario con cantidad, ticker y moneda.',
  input_schema: { type: 'object', properties: {}, additionalProperties: false },
  async execute() {
    const rows = await db.asset.findMany({ orderBy: { createdAt: 'asc' } });
    return {
      ok: true,
      data: rows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        quantity: Number(a.quantity),
        ticker: a.ticker,
        currency: a.currency,
        manualValue: a.manualValue == null ? null : Number(a.manualValue),
      })),
    };
  },
};

const createAssetTool: ToolDef = {
  name: 'create_asset',
  description:
    'Registra un activo nuevo (efectivo, cripto, acción, propiedad, etc). Para cripto/acción pasá ticker y cantidad; para efectivo/propiedad pasá manualValue con el valor total. El precio en vivo se obtiene de CoinMarketCap si hay ticker.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Etiqueta visible del activo (ej. "BTC Binance").' },
      type: {
        type: 'string',
        enum: ['cash_usd', 'cash_ars', 'stock', 'crypto', 'property', 'other'],
      },
      quantity: { type: 'number', description: 'Cantidad de unidades (1 para propiedades/cash).' },
      ticker: {
        type: 'string',
        description: 'Símbolo en mayúsculas para cripto/acción (ej. "BTC", "ETH").',
      },
      manualValue: {
        type: 'number',
        description: 'Valor total del activo cuando no hay ticker (efectivo, propiedad).',
      },
      currency: { type: 'string', enum: ['USD', 'ARS'] },
    },
    required: ['name', 'type', 'quantity', 'currency'],
    additionalProperties: false,
  },
  async execute(input) {
    const name = str(input.name).trim();
    const type = str(input.type);
    if (!name) return { ok: false, error: 'name es requerido' };
    if (!ASSET_TYPES.includes(type as (typeof ASSET_TYPES)[number])) {
      return { ok: false, error: `type inválido. Opciones: ${ASSET_TYPES.join(', ')}` };
    }
    const quantity = num(input.quantity);
    if (quantity < 0) return { ok: false, error: 'quantity no puede ser negativa' };
    const currency = str(input.currency);
    if (currency !== 'USD' && currency !== 'ARS') {
      return { ok: false, error: 'currency debe ser USD o ARS' };
    }
    const ticker = str(input.ticker).trim().toUpperCase() || null;
    const manualValue = input.manualValue == null ? null : num(input.manualValue);
    const priceSource: 'coinmarketcap' | 'manual' = ticker ? 'coinmarketcap' : 'manual';

    const created = await db.asset.create({
      data: {
        name,
        type,
        quantity,
        ticker,
        priceSource,
        manualValue,
        currency,
      },
    });

    // Fetch opcional de precio inicial — si falla, no rompe la creación.
    if (ticker) {
      try {
        const [price] = await fetchCryptoPrices([ticker]);
        if (price && price.price > 0) {
          await db.marketPrice.create({
            data: {
              ticker,
              price: price.price,
              changePct24h: price.changePct24h,
              fetchedAt: price.fetchedAt,
            },
          });
        }
      } catch {
        /* silencio: el asset ya se creó, el precio se puede actualizar después */
      }
    }
    await generateDailySnapshot().catch(() => {});

    return {
      ok: true,
      data: { id: created.id, name: created.name, ticker, quantity },
      action: {
        tool: 'create_asset',
        label: `Agregué el activo "${created.name}"${ticker ? ` (${ticker})` : ''}`,
        entityId: created.id,
      },
    };
  },
};

const createLiabilityTool: ToolDef = {
  name: 'create_liability',
  description: 'Registra una deuda o pasivo (tarjeta de crédito, préstamo, etc).',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      amount: { type: 'number', description: 'Monto total pendiente.' },
      currency: { type: 'string', enum: ['USD', 'ARS'] },
      dueDate: { type: 'string', description: 'Fecha de vencimiento YYYY-MM-DD (opcional).' },
      note: { type: 'string' },
    },
    required: ['name', 'amount', 'currency'],
    additionalProperties: false,
  },
  async execute(input) {
    const name = str(input.name).trim();
    const amount = num(input.amount);
    const currency = str(input.currency);
    if (!name) return { ok: false, error: 'name requerido' };
    if (amount <= 0) return { ok: false, error: 'amount debe ser positivo' };
    if (currency !== 'USD' && currency !== 'ARS') return { ok: false, error: 'currency USD|ARS' };
    const dueDateRaw = str(input.dueDate).trim();
    const dueDate = dueDateRaw ? parseDateYmd(dueDateRaw, new Date()) : null;
    const note = str(input.note).trim() || null;
    const created = await db.liability.create({
      data: { name, amount, currency, dueDate, note },
    });
    await generateDailySnapshot().catch(() => {});
    return {
      ok: true,
      data: { id: created.id, name, amount, currency },
      action: {
        tool: 'create_liability',
        label: `Registré la deuda "${name}" (${currency === 'USD' ? 'US$' : 'AR$'}${amount})`,
        entityId: created.id,
      },
    };
  },
};

const getFinancialSummaryTool: ToolDef = {
  name: 'get_financial_summary',
  description:
    'Devuelve un resumen breve del patrimonio actual: total de activos USD, pasivos USD, flujo del mes corriente. Usala cuando el usuario pida números concretos sin haberlos dado.',
  input_schema: { type: 'object', properties: {}, additionalProperties: false },
  async execute() {
    const { computeNetWorth } = await import('@/lib/queries/portfolio');
    const nw = await computeNetWorth().catch(() => null);
    if (!nw) return { ok: false, error: 'No se pudo calcular el patrimonio.' };
    // Flujo del mes corriente.
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const txs = await db.transaction.findMany({
      where: { date: { gte: monthStart } },
    });
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      const amt = Number(t.amount);
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return {
      ok: true,
      data: {
        assetsUsd: Math.round(nw.assetsUsd * 100) / 100,
        liabilitiesUsd: Math.round(nw.liabilitiesUsd * 100) / 100,
        netWorthUsd: Math.round(nw.netWorthUsd * 100) / 100,
        rateType: nw.rateType,
        monthIncomeRaw: income,
        monthExpenseRaw: expense,
        note: 'monthIncomeRaw y monthExpenseRaw son sumas crudas sin convertir moneda — sumá USD y ARS separadamente si lo necesitás.',
      },
    };
  },
};

export const ALL_TOOLS: ToolDef[] = [
  listCategoriesTool,
  createCategoryTool,
  createTransactionTool,
  listAssetsTool,
  createAssetTool,
  createLiabilityTool,
  getFinancialSummaryTool,
];

/** Definiciones para mandarle a Claude en cada llamada. */
export function getToolDefinitions(): Anthropic.Tool[] {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as unknown as Anthropic.Tool['input_schema'],
  }));
}

/** Ejecuta una tool por nombre con el input que dio el modelo. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Herramienta desconocida: ${name}` };
  try {
    return await tool.execute(input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error ejecutando la herramienta',
    };
  }
}
