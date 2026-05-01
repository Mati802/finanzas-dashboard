import { NextResponse } from 'next/server';
import { getLatestExchangeRates, refreshRatesIfStale } from '@/lib/rates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await refreshRatesIfStale();
  } catch (err) {
    console.error('rate refresh failed', err);
  }
  const rates = await getLatestExchangeRates();
  return NextResponse.json({ rates });
}
