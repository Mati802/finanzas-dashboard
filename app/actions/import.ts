'use server';

import { revalidatePath } from 'next/cache';
import { parseFinanzasWorkbook, applyParsedWorkbook, type ParsedWorkbook } from '@/lib/import-excel';
import { generateDailySnapshot } from '@/lib/snapshot';

export interface ImportPreview {
  transactions: number;
  assets: number;
  warnings: string[];
  parsed: ParsedWorkbook;
}

export async function previewExcel(formData: FormData): Promise<ImportPreview> {
  const file = formData.get('file') as File | null;
  if (!file) throw new Error('No se recibió archivo');
  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = parseFinanzasWorkbook(buf);
  return {
    transactions: parsed.transactions.length,
    assets: parsed.assets.length,
    warnings: parsed.warnings,
    parsed,
  };
}

export async function confirmImport(
  parsed: ParsedWorkbook
): Promise<{ transactions: number; assets: number; newCategories: number }> {
  const result = await applyParsedWorkbook(parsed);
  await generateDailySnapshot().catch(() => {});
  revalidatePath('/');
  revalidatePath('/transacciones');
  revalidatePath('/ingresos');
  revalidatePath('/gastos');
  revalidatePath('/inversiones');
  revalidatePath('/patrimonio');
  revalidatePath('/reportes');
  return result;
}
