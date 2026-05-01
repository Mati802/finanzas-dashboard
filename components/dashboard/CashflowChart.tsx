'use client';

import {
  Bar,
  BarChart,
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
  income: number;
  expense: number;
  savings: number;
}

export function CashflowChart({ data }: { data: Point[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Flujo de efectivo</CardTitle>
          <CardDescription>Últimos 6 meses · USD</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pb-5 pr-5">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -15 }} barCategoryGap={14}>
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
                cursor={{ fill: 'rgba(139,92,246,0.06)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: '#a1a1aa', paddingTop: 6 }}
                iconType="square"
              />
              <Bar name="Ingresos" dataKey="income" fill="#4ade80" radius={[3, 3, 0, 0]} />
              <Bar name="Gastos" dataKey="expense" fill="#f87171" radius={[3, 3, 0, 0]} />
              <Bar name="Ahorro" dataKey="savings" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
