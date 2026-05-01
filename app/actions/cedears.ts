'use server';

import { revalidatePath } from 'next/cache';
import { refreshCedearQuotes } from '@/lib/queries/cedears';

export async function refreshCedears() {
  const n = await refreshCedearQuotes();
  revalidatePath('/inversiones');
  return n;
}
