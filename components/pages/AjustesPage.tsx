import { db } from '@/lib/db';
import { getDefaultRateType } from '@/lib/convert';
import { AjustesView } from './AjustesView';

export async function AjustesPage() {
  const [defaultRateType, categories, tickerItems] = await Promise.all([
    getDefaultRateType(),
    db.category.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] }),
    db.tickerItem.findMany({ orderBy: { orderIndex: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Ajustes</h1>
        <p className="mt-0.5 text-[11px] text-fg-subtle">
          Configuración general, categorías, ticker y herramientas de datos
        </p>
      </header>

      <AjustesView
        defaultRateType={defaultRateType}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          icon: c.icon,
          color: c.color,
          isRecurring: c.isRecurring,
        }))}
        tickerItems={tickerItems.map((t) => ({
          id: t.id,
          displayLabel: t.displayLabel,
          sourceType: t.sourceType,
          sourceKey: t.sourceKey,
          orderIndex: t.orderIndex,
          isVisible: t.isVisible,
        }))}
      />
    </div>
  );
}
