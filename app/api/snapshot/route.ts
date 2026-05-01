import { NextResponse } from 'next/server';
import { generateDailySnapshot } from '@/lib/snapshot';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  const snap = await generateDailySnapshot();
  revalidatePath('/');
  revalidatePath('/patrimonio');
  return NextResponse.json({
    ok: true,
    date: snap.date,
    netWorthUsd: Number(snap.netWorthUsd),
    assetsUsd: Number(snap.assetsUsd),
    liabilitiesUsd: Number(snap.liabilitiesUsd),
  });
}
