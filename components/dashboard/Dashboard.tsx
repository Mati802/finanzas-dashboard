import { getDashboardData } from '@/lib/queries/dashboard';
import { KPICard } from './KPICard';
import { PatrimonioChart } from './PatrimonioChart';
import { ComparisonChart } from './ComparisonChart';
import { CashflowChart } from './CashflowChart';
import { CategoryBreakdown } from './CategoryBreakdown';
import { AssetDonut } from './AssetDonut';
import { NetWorthBreakdown } from './NetWorthBreakdown';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

export async function Dashboard() {
  const data = await getDashboardData();

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            Resumen en tiempo real · {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Patrimonio neto"
          value={data.netWorth.valueUsd}
          currency="USD"
          sub={data.netWorth.valueArs}
          variant="purple"
          icon={Wallet}
          trend={data.netWorth.trendPct}
        />
        <KPICard
          label="Ingresos del mes"
          value={data.monthlyIncome.valueUsd}
          currency="USD"
          sub={data.monthlyIncome.valueArs}
          variant="green"
          icon={TrendingUp}
          trend={data.monthlyIncome.trendPct}
        />
        <KPICard
          label="Gastos del mes"
          value={data.monthlyExpense.valueUsd}
          currency="USD"
          sub={data.monthlyExpense.valueArs}
          variant="red"
          icon={TrendingDown}
          trend={data.monthlyExpense.trendPct}
          negativeTrend
        />
        <KPICard
          label="Ahorro del mes"
          value={data.monthlySavings.valueUsd}
          currency="USD"
          sub={`${data.monthlySavings.rate.toFixed(1)}% tasa ahorro`}
          variant="orange"
          icon={DollarSign}
          trend={data.monthlySavings.trendPct}
        />
      </div>

      {/* Desglose del patrimonio neto: cuentas / inversiones / objetos / deudas */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
            Desglose del patrimonio
          </h2>
          <span className="text-[10px] text-fg-subtle">% sobre activos totales</span>
        </div>
        <NetWorthBreakdown {...data.netWorthBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[2fr_1fr]">
        <PatrimonioChart points={data.netWorthHistory} />
        <AssetDonut assets={data.assetBreakdown} total={data.netWorth.valueUsd} />
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <ComparisonChart data={data.yearComparison} />
        <CashflowChart data={data.cashflow} />
      </div>

      <CategoryBreakdown categories={data.categoryBreakdown} />
    </div>
  );
}
