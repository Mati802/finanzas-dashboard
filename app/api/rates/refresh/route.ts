import { NextResponse } from 'next/server';
import { refreshAllRates } from '@/lib/rates';

export const dynamic = 'force-dynamic';

export async function POST() {
  const summary = await refreshAllRates();
  return NextResponse.json(summary);
}
