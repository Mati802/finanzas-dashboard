'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { generateDailySnapshot } from '@/lib/snapshot';

const LiabilitySchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'ARS']),
  dueDate: z.string().optional(),
  note: z.string().optional(),
});

export async function upsertLiability(formData: FormData) {
  const raw = {
    id: formData.get('id') ? Number(formData.get('id')) : undefined,
    name: String(formData.get('name') ?? '').trim(),
    amount: Number(formData.get('amount') ?? 0),
    currency: String(formData.get('currency') ?? 'USD') as 'USD' | 'ARS',
    dueDate: (String(formData.get('dueDate') ?? '').trim() || undefined) as string | undefined,
    note: (String(formData.get('note') ?? '').trim() || undefined) as string | undefined,
  };
  const parsed = LiabilitySchema.parse(raw);
  const dueDate = parsed.dueDate ? new Date(parsed.dueDate + 'T12:00:00.000Z') : null;

  if (parsed.id) {
    await db.liability.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        amount: parsed.amount,
        currency: parsed.currency,
        dueDate,
        note: parsed.note ?? null,
      },
    });
  } else {
    await db.liability.create({
      data: {
        name: parsed.name,
        amount: parsed.amount,
        currency: parsed.currency,
        dueDate,
        note: parsed.note ?? null,
      },
    });
  }

  await generateDailySnapshot().catch(() => {});
  revalidatePath('/');
  revalidatePath('/patrimonio');
}

export async function deleteLiability(id: number) {
  await db.liability.delete({ where: { id } });
  await generateDailySnapshot().catch(() => {});
  revalidatePath('/');
  revalidatePath('/patrimonio');
}
