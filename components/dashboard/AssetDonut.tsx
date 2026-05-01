'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { formatUSD } from '@/lib/format';

interface AssetSlice {
  type: string;
  label: string;
  valueUsd: number;
  pct: number;
  color: string;
}

export function AssetDonut({ assets, total }: { assets: AssetSlice[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Composición de activos</CardTitle>
          <CardDescription>Distribución por tipo</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        <div className="relative h-[130px] w-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={assets}
                dataKey="valueUsd"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={62}
                paddingAngle={2}
                stroke="none"
              >
                {assets.map((a, i) => (
                  <Cell key={i} fill={a.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1a1a22',
                  border: '1px solid #2a2a32',
                  borderRadius: 6,
                  fontSize: 11,
                }}
                formatter={(v: number) => formatUSD(v)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] uppercase tracking-wide text-fg-subtle">Total</div>
            <div className="text-[13px] font-bold tabular-num">{formatUSD(total, { compact: true })}</div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {assets.length === 0 && (
            <p className="py-4 text-center text-[11px] text-fg-subtle">Sin activos cargados</p>
          )}
          {assets.map((a) => (
            <div key={a.type} className="flex items-center gap-2 text-[10px]">
              <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: a.color }} />
              <span className="flex-1 truncate text-fg-muted">{a.label}</span>
              <span className="font-semibold text-fg">{a.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
