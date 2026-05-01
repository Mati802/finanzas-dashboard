import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { RateType } from '@/lib/types';
import { RATE_TYPES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get('type') ?? 'blue') as RateType;
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') ?? 30)));

  if (!RATE_TYPES.includes(type)) {
    return NextResponse.json({ error: `invalid rate type: ${type}` }, { status: 400 });
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db.exchangeRate.findMany({
    where: { type, fetchedAt: { gte: since } },
    orderBy: { fetchedAt: 'asc' },
  });

  const points = rows.map((r) => ({
    date: r.fetchedAt.toISOString(),
    buy: Number(r.buyPrice),
    sell: Number(r.sellPrice),
  }));

  return NextResponse.json({ type, days, points });
}
