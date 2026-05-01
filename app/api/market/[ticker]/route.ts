import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const row = await db.marketPrice.findFirst({
    where: { ticker },
    orderBy: { fetchedAt: 'desc' },
  });
  if (!row) {
    return NextResponse.json({ error: `no price for ${ticker}` }, { status: 404 });
  }
  return NextResponse.json({
    ticker: row.ticker,
    price: Number(row.price),
    changePct24h: Number(row.changePct24h),
    fetchedAt: row.fetchedAt.toISOString(),
  });
}
