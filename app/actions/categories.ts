'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';

const CategorySchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  kind: z.enum(['fixed', 'variable', 'income']),
  icon: z.string().min(1).default('tag'),
  color: z.string().min(1).default('#71717a'),
  isRecurring: z.boolean().default(false),
});

export async function upsertCategory(formData: FormData) {
  const raw = {
    id: formData.get('id') ? Number(formData.get('id')) : undefined,
    name: String(formData.get('name') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'variable') as 'fixed' | 'variable' | 'income',
    icon: String(formData.get('icon') ?? 'tag'),
    color: String(formData.get('color') ?? '#71717a'),
    isRecurring: formData.get('isRecurring') === 'on',
  };
  const parsed = CategorySchema.parse(raw);

  let row;
  if (parsed.id) {
    row = await db.category.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        kind: parsed.kind,
        icon: parsed.icon,
        color: parsed.color,
        isRecurring: parsed.isRecurring,
      },
    });
  } else {
    row = await db.category.create({
      data: {
        name: parsed.name,
        kind: parsed.kind,
        icon: parsed.icon,
        color: parsed.color,
        isRecurring: parsed.isRecurring,
      },
    });
  }

  revalidatePath('/ajustes');
  revalidatePath('/gastos');
  revalidatePath('/ingresos');

  return { id: row.id, name: row.name, kind: row.kind };
}

export async function deleteCategory(id: number) {
  // Safety: only allow deletion if there are no transactions in this category.
  const count = await db.transaction.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error(`La categoría tiene ${count} transacciones asociadas.`);
  }
  await db.category.delete({ where: { id } });
  revalidatePath('/ajustes');
}

export async function listCategories() {
  return db.category.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
}
