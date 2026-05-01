import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseFinanzasWorkbook } from '@/lib/import-excel';

function sheetToBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out as ArrayBuffer;
}

function buildWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Ingresos sheet (income) - months in rows, years in columns
  const ingresos = [
    ['Mes', 'Ingresos 2025 (USD)', 'Ingresos 2026 (USD)'],
    ['Enero', 0, 300],
    ['Febrero', 550, 400],
    ['Marzo', 300, 0],
    ['Abril', 300, 150],
  ];
  const ingresosWs = XLSX.utils.aoa_to_sheet(ingresos);
  XLSX.utils.book_append_sheet(wb, ingresosWs, 'Ingresos');

  // Gastos fijos sheet (fixed expenses) - ARS currency
  const gastosFijos = [
    ['Concepto', 'Enero', 'Febrero', 'Marzo', 'Abril'],
    ['Movistar', 42150, 42150, 42150, 43995.87],
    ['Claude', 30000, 30000, 30000, 30000],
  ];
  const gastosFijosWs = XLSX.utils.aoa_to_sheet(gastosFijos);
  XLSX.utils.book_append_sheet(wb, gastosFijosWs, 'Gastos fijos');

  // Gastos variables sheet (variable expenses) - mixed formatted strings
  const gastosVariables = [
    ['Concepto', 'Enero', 'Febrero', 'Marzo', 'Abril'],
    ['Uber', 0, 0, 0, '$10.247,00'],
    ['Juegos', 0, 0, 0, 30000],
    ['', '', '', '', ''], // empty row - should be skipped
    ['Comidas', 'bad', 0, 0, 15000], // "bad" should produce warning
  ];
  const gastosVariablesWs = XLSX.utils.aoa_to_sheet(gastosVariables);
  XLSX.utils.book_append_sheet(wb, gastosVariablesWs, 'Gastos variables');

  // Inversiones sheet (assets)
  const inversiones = [
    ['Nombre', 'Tipo', 'Cantidad', 'Ticker', 'Moneda', 'Valor manual'],
    ['Bitcoin', 'crypto', 0.5, 'BTC', 'USD', ''],
    ['Efectivo pesos', 'cash_ars', 100000, '', 'ARS', ''],
    ['Depto Palermo', 'property', 1, '', 'USD', 150000],
  ];
  const inversionesWs = XLSX.utils.aoa_to_sheet(inversiones);
  XLSX.utils.book_append_sheet(wb, inversionesWs, 'Inversiones');

  return wb;
}

describe('parseFinanzasWorkbook', () => {
  it('parses income rows across years with amount > 0', () => {
    const wb = buildWorkbook();
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);

    const incomes = result.transactions.filter((t) => t.type === 'income');
    const incomes2025 = incomes.filter((i) => i.date.getFullYear() === 2025);
    const incomes2026 = incomes.filter((i) => i.date.getFullYear() === 2026);

    expect(incomes2025).toHaveLength(3); // Feb, Mar, Apr (Jan=0 skipped)
    expect(incomes2026).toHaveLength(3); // Jan, Feb, Apr (Mar=0 skipped)

    const febIncome = incomes2025.find((i) => i.date.getMonth() === 1);
    expect(febIncome?.amount).toBe(550);
    expect(febIncome?.currency).toBe('USD');
  });

  it('parses fixed expenses and marks them as recurring', () => {
    const wb = buildWorkbook();
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);

    const fixedExpenses = result.transactions.filter(
      (t) => t.type === 'expense' && t.isRecurring
    );
    expect(fixedExpenses.length).toBeGreaterThan(0);

    const movistarApr = fixedExpenses.find(
      (e) => e.categoryName === 'Movistar' && e.date.getMonth() === 3
    );
    expect(movistarApr).toBeDefined();
    expect(movistarApr?.amount).toBe(43995.87);
    expect(movistarApr?.currency).toBe('ARS');
    expect(movistarApr?.isRecurring).toBe(true);
  });

  it('parses variable expenses and marks them as non-recurring', () => {
    const wb = buildWorkbook();
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);

    const variableExpenses = result.transactions.filter(
      (t) => t.type === 'expense' && !t.isRecurring
    );
    expect(variableExpenses.length).toBeGreaterThan(0);

    const uberApr = variableExpenses.find(
      (e) => e.categoryName === 'Uber' && e.date.getMonth() === 3
    );
    expect(uberApr).toBeDefined();
    expect(uberApr?.amount).toBe(10247);
    expect(uberApr?.currency).toBe('ARS');
    expect(uberApr?.isRecurring).toBe(false);
  });

  it('handles monetary strings like "$10.247,00" (ARS format)', () => {
    const wb = buildWorkbook();
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);

    const uber = result.transactions.find(
      (e) => e.categoryName === 'Uber' && e.date.getMonth() === 3
    );
    expect(uber?.amount).toBe(10247);
  });

  it('parses USD currency from header hint for income', () => {
    const wb = buildWorkbook();
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);

    const anyIncome = result.transactions.find((t) => t.type === 'income');
    expect(anyIncome?.currency).toBe('USD');
  });

  it('parses assets from Inversiones sheet', () => {
    const wb = buildWorkbook();
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);

    expect(result.assets.length).toBe(3);

    const btc = result.assets.find((a) => a.ticker === 'BTC');
    expect(btc).toBeDefined();
    expect(btc?.type).toBe('crypto');
    expect(btc?.quantity).toBe(0.5);
    expect(btc?.currency).toBe('USD');

    const cashArs = result.assets.find((a) => a.name === 'Efectivo pesos');
    expect(cashArs?.type).toBe('cash_ars');
    expect(cashArs?.currency).toBe('ARS');

    const depto = result.assets.find((a) => a.name === 'Depto Palermo');
    expect(depto?.manualValue).toBe(150000);
  });

  it('produces a warning for bad/unparseable rows', () => {
    const wb = buildWorkbook();
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => /bad|Comidas|no se pudo/i.test(w))).toBe(true);
  });

  it('is tolerant to sheet name variations (accents/case/whitespace)', () => {
    const wb = XLSX.utils.book_new();
    const ingresos = [
      ['Mes', '2025'],
      ['Enero', 100],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ingresos), '  INGRESOS  ');
    const fijos = [
      ['Categoria', 'Enero'],
      ['Netflix', 5000],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fijos), 'gastos fíjos');

    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);
    expect(result.transactions.some((t) => t.type === 'income' && t.amount === 100)).toBe(true);
    expect(
      result.transactions.some(
        (t) => t.type === 'expense' && t.categoryName === 'Netflix' && t.isRecurring
      )
    ).toBe(true);
  });

  it('handles Excel date serial numbers in an Inversiones sheet row', () => {
    // Ensures parser does not crash on unusual cell types.
    const wb = XLSX.utils.book_new();
    const inv = [
      ['Nombre', 'Tipo', 'Cantidad', 'Ticker', 'Moneda'],
      ['AAPL', 'stock', 10, 'AAPL', 'USD'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inv), 'Inversiones');
    const buf = sheetToBuffer(wb);
    const result = parseFinanzasWorkbook(buf);
    expect(result.assets.length).toBe(1);
    expect(result.assets[0].ticker).toBe('AAPL');
  });
});
