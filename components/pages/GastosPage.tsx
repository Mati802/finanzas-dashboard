import { db } from '@/lib/db';
import { listTransactionsByMonth } from '@/lib/queries/transactions';
import { GastosView } from './GastosView';
import { AddTransactionButton } from './AddTransactionButton';

export async function GastosPage({
  searchParams,
}: {
  searchParams?: { year?: string; month?: string };
}) {
  const now = new Date();
  const year = Number(searchParams?.year ?? now.getFullYear());
  const month = Number(searchParams?.month ?? now.getMonth() + 1);

  const [transactions, recurringCategories] = await Promise.all([
    listTransactionsByMonth(year, month),
    db.category.findMany({ where: { isRecurring: true } }),
  ]);

  const expenses = transactions.filter((t) => t.type === 'expense');

  // Compute recurring categories missing this month
  const paidCategoryIds = new Set(expenses.map((t) => t.categoryId));
  const missingRecurring = recurringCategories.filter((c) => !paidCategoryIds.has(c.id));

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gastos</h1>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            Fijos y variables del mes · separados por tipo
          </p>
        </div>
        <AddTransactionButton defaultType="expense" />
      </header>

      <GastosView
        year={year}
        month={month}
        expenses={expenses}
        missingRecurring={missingRecurring}
      />
    </div>
  );
}
