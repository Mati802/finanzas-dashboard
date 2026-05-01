import { listTransactionsByYear, getMonthlyTotals } from '@/lib/queries/transactions';
import { ComparisonChart } from '@/components/dashboard/ComparisonChart';
import { IngresosTable } from './IngresosTable';
import { AddTransactionButton } from './AddTransactionButton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { formatUSD } from '@/lib/format';

export async function IngresosPage({ searchParams }: { searchParams?: { year?: string } }) {
  const now = new Date();
  const year = Number(searchParams?.year ?? now.getFullYear());

  const [thisYear, prev, totalsCurrent, totalsPrevious] = await Promise.all([
    listTransactionsByYear(year),
    listTransactionsByYear(year - 1),
    getMonthlyTotals(year),
    getMonthlyTotals(year - 1),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const comparison = months.map((m) => ({
    month: new Date(year, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }),
    current: totalsCurrent[m - 1]?.income ?? 0,
    previous: totalsPrevious[m - 1]?.income ?? 0,
  }));

  const totalYear = thisYear.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalPrev = prev.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ingresos</h1>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            Seguimiento anual y comparativa histórica
          </p>
        </div>
        <AddTransactionButton defaultType="income" />
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Total {year}</CardTitle>
              <CardDescription>Ingresos acumulados este año</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-num">{formatUSD(totalYear)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Total {year - 1}</CardTitle>
              <CardDescription>Año anterior</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-num text-fg-muted">{formatUSD(totalPrev)}</div>
          </CardContent>
        </Card>
      </div>

      <ComparisonChart data={comparison} />

      <IngresosTable
        transactions={thisYear.filter((t) => t.type === 'income')}
        year={year}
      />
    </div>
  );
}
