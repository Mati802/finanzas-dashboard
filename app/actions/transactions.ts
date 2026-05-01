'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { generateDailySnapshot } from '@/lib/snapshot';

const TransactionSchema = z.object({
  id: z.number().int().positive().optional(),
  date: z.string().min(1),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'ARS']),
  categoryId: z.coerce.number().int().positive(),
  note: z.string().optional().default(''),
});

export async function upsertTransaction(formData: FormData) {
  const raw = {
    id: formData.get('id') ? Number(formData.get('id')) : undefined,
    date: String(formData.get('date') ?? ''),
    type: String(formData.get('type') ?? 'expense') as 'income' | 'expense',
    amount: Number(formData.get('amount') ?? 0),
    currency: String(formData.get('currency') ?? 'USD') as 'USD' | 'ARS',
    categoryId: Number(formData.get('categoryId') ?? 0),
    note: String(formData.get('note') ?? ''),
  };
  const parsed = TransactionSchema.parse(raw);
  const date = new Date(parsed.date + 'T12:00:00.000Z');

  if (parsed.id) {
    await db.transaction.update({
      where: { id: parsed.id },
      data: {
        date,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        categoryId: parsed.categoryId,
        note: parsed.note || null,
      },
    });
  } else {
    await db.transaction.create({
      data: {
        date,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        categoryId: parsed.categoryId,
        note: parsed.note || null,
      },
    });
  }

  // Any change affects balances and net worth -> update today's snapshot.
  await generateDailySnapshot().catch(() => {});

  revalidatePath('/');
  revalidatePath('/transacciones');
  revalidatePath('/ingresos');
  revalidatePath('/gastos');
  revalidatePath('/patrimonio');
  revalidatePath('/reportes');
}

export async function deleteTransaction(id: number) {
  await db.transaction.delete({ where: { id } });
  await generateDailySnapshot().catch(() => {});
  revalidatePath('/');
  revalidatePath('/transacciones');
  revalidatePath('/ingresos');
  revalidatePath('/gastos');
  revalidatePath('/patrimonio');
  revalidatePath('/reportes');
}
