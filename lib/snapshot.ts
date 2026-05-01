import 'server-only';
import { db } from '@/lib/db';
import { computeNetWorth } from '@/lib/queries/portfolio';

/**
 * Genera un snapshot diario del patrimonio neto, upsert por fecha (00:00 UTC).
 * Idempotente: si ya existe un snapshot para hoy, se actualiza.
 */
export async function generateDailySnapshot() {
  const nw = await computeNetWorth();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const result = await db.snapshot.upsert({
    where: { date: today },
    update: {
      assetsUsd: nw.assetsUsd,
      liabilitiesUsd: nw.liabilitiesUsd,
      netWorthUsd: nw.netWorthUsd,
      exchangeRateUsed: nw.exchangeRateUsed,
    },
    create: {
      date: today,
      assetsUsd: nw.assetsUsd,
      liabilitiesUsd: nw.liabilitiesUsd,
      netWorthUsd: nw.netWorthUsd,
      exchangeRateUsed: nw.exchangeRateUsed,
    },
  });
  return result;
}
