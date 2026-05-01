'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TransactionForm, type CategoryOption } from '@/components/forms/TransactionForm';
import { listCategories } from '@/app/actions/categories';

export interface AddTransactionButtonProps {
  defaultType?: 'income' | 'expense';
  label?: string;
}

export function AddTransactionButton({ defaultType = 'expense', label }: AddTransactionButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryOption[] | null>(null);

  // Re-fetch categorías cada vez que se abre el diálogo. Antes se cacheaban
  // en el primer open y nunca se refrescaban — eso ocultaba las categorías
  // creadas en otra parte de la app (ej. Ajustes) hasta hacer reload duro.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listCategories().then((rows) => {
      if (!cancelled) {
        setCategories(rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-3.5 w-3.5" />
          {label ?? 'Agregar'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Nueva {defaultType === 'income' ? 'entrada' : 'salida'}
          </DialogTitle>
          <DialogDescription>
            Registrá un {defaultType === 'income' ? 'ingreso' : 'gasto'} del mes.
          </DialogDescription>
        </DialogHeader>
        {categories ? (
          <TransactionForm
            categories={categories}
            defaultType={defaultType}
            onDone={() => setOpen(false)}
          />
        ) : (
          <div className="py-6 text-center text-xs text-fg-subtle">Cargando categorías…</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
