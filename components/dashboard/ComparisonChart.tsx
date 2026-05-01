'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { formatUSD, formatCompactUsd } from '@/lib/format';

interface Point {
  month: string;
  current: number;
  previous: number;
}

export function ComparisonChart({ data }: { data: Point[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Ingresos: año actual vs anterior</CardTitle>
          <CardDescription>Comparativa mensual · USD</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pb-5 pr-5">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
              <defs>
                <linearGradient id="cur-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="prev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#71717a" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#71717a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#17171f" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="month"
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
                formatter={(v: number) => formatUSD(v)}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: '#a1a1aa', paddingTop: 6 }}
                iconType="square"
              />
              <Area
                type="monotone"
                name="Año anterior"
                dataKey="previous"
                stroke="#71717a"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                fill="url(#prev-grad)"
              />
              <Area
                type="monotone"
                name="Año actual"
                dataKey="current"
                stroke="#4ade80"
                strokeWidth={2}
                fill="url(#cur-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
