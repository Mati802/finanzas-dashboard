'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { formatUSD, formatCompactUsd } from '@/lib/format';

interface Point {
  date: string; // ISO or yyyy-mm
  valueUsd: number;
}

export function PatrimonioChart({ points }: { points: Point[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Evolución del patrimonio</CardTitle>
          <CardDescription>Últimos 12 meses · USD</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pb-5 pr-5">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 5, bottom: 0, left: -15 }}>
              <defs>
                <linearGradient id="pat-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#17171f" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#71717a' }}
                tickLine={false}
                axisLine={{ stroke: '#17171f' }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCompactUsd}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1a22',
                  border: '1px solid #2a2a32',
                  borderRadius: 6,
                  fontSize: 11,
                }}
                labelStyle={{ color: '#71717a', fontSize: 10 }}
                formatter={(v: number) => [formatUSD(v), 'Patrimonio']}
              />
              <Area
                type="monotone"
                dataKey="valueUsd"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#pat-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
