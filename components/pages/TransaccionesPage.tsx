import { listTransactionsByMonth } from '@/lib/queries/transactions';
import { TransaccionesTable } from './TransaccionesTable';
import { AddTransactionButton } from './AddTransactionButton';

export async function TransaccionesPage({
  searchParams,
}: {
  searchParams?: { year?: string; month?: string };
}) {
  const now = new Date();
  const year = Number(searchParams?.year ?? now.getFullYear());
  const month = Number(searchParams?.month ?? now.getMonth() + 1);
  const transactions = await listTransactionsByMonth(year, month);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Transacciones</h1>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            Ingresos y gastos del mes seleccionado
          </p>
        </div>
        <AddTransactionButton />
      </header>
      <TransaccionesTable transactions={transactions} year={year} month={month} />
    </div>
  );
}
