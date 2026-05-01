import type { RateType } from '@/lib/types';

export interface NormalizedRate {
  type: RateType;
  buyPrice: number;
  sellPrice: number;
  fetchedAt: Date;
}

const CASA_MAP: Record<string, RateType> = {
  oficial: 'oficial',
  blue: 'blue',
  bolsa: 'mep',
  contadoconliqui: 'ccl',
  cripto: 'usdt',
};

interface DolarApiRow {
  casa: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export async function fetchDolarApiRates(): Promise<NormalizedRate[]> {
  const res = await fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`dolarapi request failed: ${res.status}`);
  }
  const rows = (await res.json()) as DolarApiRow[];
  return rows
    .filter((row) => CASA_MAP[row.casa])
    .map<NormalizedRate>((row) => ({
      type: CASA_MAP[row.casa],
      buyPrice: row.compra,
      sellPrice: row.venta,
      fetchedAt: new Date(row.fechaActualizacion),
    }));
}
