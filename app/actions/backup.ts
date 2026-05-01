'use server';

import fs from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';

const DB_FILE = path.resolve(process.cwd(), 'finanzas.db');

export async function downloadBackup(): Promise<{ filename: string; data: string }> {
  const buf = await fs.readFile(DB_FILE);
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `finanzas-${date}.db`,
    data: buf.toString('base64'),
  };
}

export async function restoreBackup(formData: FormData) {
  const file = formData.get('file') as File | null;
  if (!file) throw new Error('Seleccioná un archivo .db');
  const buf = Buffer.from(await file.arrayBuffer());
  // Preserve the current DB just in case.
  try {
    await fs.copyFile(DB_FILE, `${DB_FILE}.prev-${Date.now()}`);
  } catch {
    // ignore if not present
  }
  await fs.writeFile(DB_FILE, buf);
  revalidatePath('/');
  revalidatePath('/ajustes');
}
