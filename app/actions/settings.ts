'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { RATE_TYPES } from '@/lib/types';
import type { TickerSourceType } from '@/lib/types';

const TICKER_SOURCE_TYPES: TickerSourceType[] = ['fx_ars', 'fx_usd', 'crypto', 'stock', 'index'];

export async function updateDefaultRate(formData: FormData) {
  const value = String(formData.get('value') ?? 'blue');
  if (!(RATE_TYPES as readonly string[]).includes(value)) {
    throw new Error(`tasa inválida: ${value}`);
  }
  await db.setting.upsert({
    where: { key: 'default_rate_type' },
    update: { value },
    create: { key: 'default_rate_type', value },
  });
  revalidatePath('/');
  revalidatePath('/ajustes');
  revalidatePath('/patrimonio');
  revalidatePath('/inversiones');
}

export async function updateTickerItemVisibility(id: number, visible: boolean) {
  await db.tickerItem.update({ where: { id }, data: { isVisible: visible } });
  revalidatePath('/ajustes');
}

export async function reorderTickerItems(orderedIds: number[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.tickerItem.update({ where: { id }, data: { orderIndex: index } })
    )
  );
  revalidatePath('/ajustes');
}

export interface CreateTickerItemInput {
  displayLabel: string;
  sourceType: TickerSourceType;
  sourceKey: string;
}

/** Agrega un nuevo ítem al ticker (cualquier activo financiero). */
export async function createTickerItem(input: CreateTickerItemInput) {
  const displayLabel = input.displayLabel.trim();
  const sourceKey = input.sourceKey.trim();
  if (!displayLabel) throw new Error('La etiqueta no puede estar vacía.');
  if (!sourceKey) throw new Error('La clave de la fuente no puede estar vacía.');
  if (!TICKER_SOURCE_TYPES.includes(input.sourceType)) {
    throw new Error(`Tipo de fuente inválido: ${input.sourceType}`);
  }

  const last = await db.tickerItem.findFirst({ orderBy: { orderIndex: 'desc' } });
  const orderIndex = (last?.orderIndex ?? -1) + 1;

  await db.tickerItem.create({
    data: {
      displayLabel,
      sourceType: input.sourceType,
      sourceKey,
      orderIndex,
      isVisible: true,
    },
  });

  revalidatePath('/ajustes');
}

export async function deleteTickerItem(id: number) {
  await db.tickerItem.delete({ where: { id } });
  revalidatePath('/ajustes');
}
