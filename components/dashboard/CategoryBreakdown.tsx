import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { formatUSD } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CategoryRow {
  name: string;
  color: string;
  icon: string;
  total: number;
  pctOfMonth: number;
}

export function CategoryBreakdown({ categories }: { categories: CategoryRow[] }) {
  const sorted = [...categories].sort((a, b) => b.total - a.total).slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Top categorías este mes</CardTitle>
          <CardDescription>Gastos ordenados por monto</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-[11px] text-fg-subtle">Sin gastos este mes</p>
        )}
        {sorted.map((c) => (
          <div key={c.name} className="flex items-center gap-3 text-[10px]">
            <span className="w-[110px] truncate text-fg-muted">{c.name}</span>
            <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-border-subtle">
              <div
                className={cn('h-full rounded-full')}
                style={{
                  width: `${Math.min(100, c.pctOfMonth).toFixed(1)}%`,
                  background: c.color,
                }}
              />
            </div>
            <span className="w-[70px] text-right font-semibold tabular-num text-fg">
              {formatUSD(c.total)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
