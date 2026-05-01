'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { upsertTransaction } from '@/app/actions/transactions';
import { upsertCategory } from '@/app/actions/categories';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

export interface CategoryOption {
  id: number;
  name: string;
  kind: string;
}

export interface TransactionFormProps {
  categories: CategoryOption[];
  defaultType?: 'income' | 'expense';
  initial?: {
    id?: number;
    date?: string;
    type?: 'income' | 'expense';
    amount?: number;
    currency?: 'USD' | 'ARS';
    categoryId?: number;
    note?: string;
  };
  onDone?: () => void;
}

type ExpenseKind = 'fixed' | 'variable';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TransactionForm({
  categories,
  defaultType = 'expense',
  initial,
  onDone,
}: TransactionFormProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [type, setType] = React.useState<'income' | 'expense'>(initial?.type ?? defaultType);
  const [currency, setCurrency] = React.useState<'USD' | 'ARS'>(initial?.currency ?? 'USD');
  const initialKind = React.useMemo<ExpenseKind>(() => {
    if (initial?.categoryId) {
      const c = categories.find((x) => x.id === initial.categoryId);
      return c?.kind === 'fixed' ? 'fixed' : 'variable';
    }
    // Default inteligente: si el usuario tiene solo categorías fijas (o solo
    // variables), arrancamos en ese kind para que el dropdown nunca aparezca
    // vacío en el primer render. Si tiene de ambos, defaulteamos a variable.
    const hasVariable = categories.some((c) => c.kind === 'variable');
    const hasFixed = categories.some((c) => c.kind === 'fixed');
    if (hasVariable) return 'variable';
    if (hasFixed) return 'fixed';
    return 'variable';
  }, [categories, initial?.categoryId]);
  const [expenseKind, setExpenseKind] = React.useState<ExpenseKind>(initialKind);

  // Si las categorías llegan después del primer render (lazy fetch en
  // AddTransactionButton/GastosView), reasignamos el kind por defecto al que
  // efectivamente tenga categorías disponibles.
  React.useEffect(() => {
    if (initial?.categoryId) return;
    setExpenseKind(initialKind);
  }, [initialKind, initial?.categoryId]);
  const [categoryId, setCategoryId] = React.useState<string>(
    initial?.categoryId ? String(initial.categoryId) : ''
  );
  const [pending, setPending] = React.useState(false);

  // Inline create state
  const [showCreateCat, setShowCreateCat] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState('');
  const [creatingCat, setCreatingCat] = React.useState(false);
  const [localCategories, setLocalCategories] = React.useState<CategoryOption[]>(categories);

  React.useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const filteredCategories = React.useMemo(() => {
    if (type === 'income') return localCategories.filter((c) => c.kind === 'income');
    return localCategories.filter((c) => c.kind === expenseKind);
  }, [localCategories, type, expenseKind]);

  // Keep categoryId valid when switching between income/expense or fixed/variable.
  React.useEffect(() => {
    if (!filteredCategories.find((c) => String(c.id) === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ? String(filteredCategories[0].id) : '');
    }
  }, [filteredCategories, categoryId]);

  async function onCreateCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    try {
      const fd = new FormData();
      fd.set('name', name);
      // Para ingresos: kind='income'. Para gastos: usa el selector fijo/variable.
      fd.set('kind', type === 'income' ? 'income' : expenseKind);
      fd.set('icon', 'tag');
      fd.set('color', type === 'income' ? '#4ade80' : expenseKind === 'fixed' ? '#8b5cf6' : '#fb923c');
      // upsertCategory devuelve la categoría creada con el id real de la DB.
      // Antes usábamos un id optimista (Math.max+1) y eso a veces no
      // coincidía con la fila en la base, rompiendo la FK al guardar la
      // transacción. Ahora usamos el id que devuelve el server.
      const created = await upsertCategory(fd);
      router.refresh();
      setLocalCategories((prev) => [...prev, created]);
      setCategoryId(String(created.id));
      setNewCatName('');
      setShowCreateCat(false);
      toast({ title: 'Categoría creada', description: name });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo crear la categoría',
        variant: 'destructive',
      });
    } finally {
      setCreatingCat(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('type', type);
    fd.set('currency', currency);
    fd.set('categoryId', categoryId);
    setPending(true);
    try {
      await upsertTransaction(fd);
      toast({ title: initial?.id ? 'Transacción actualizada' : 'Transacción agregada' });
      onDone?.();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo guardar',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as 'income' | 'expense')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Gasto</SelectItem>
              <SelectItem value="income">Ingreso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" name="date" type="date" defaultValue={initial?.date ?? todayIso()} required />
        </div>
      </div>

      {type === 'expense' && (
        <div className="space-y-1.5">
          <Label>¿Fijo o variable?</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={expenseKind === 'fixed' ? 'secondary' : 'outline'}
              onClick={() => setExpenseKind('fixed')}
              className="justify-start"
            >
              <span className="mr-2 h-2 w-2 rounded-full bg-[#8b5cf6]" />
              Gasto fijo
            </Button>
            <Button
              type="button"
              variant={expenseKind === 'variable' ? 'secondary' : 'outline'}
              onClick={() => setExpenseKind('variable')}
              className="justify-start"
            >
              <span className="mr-2 h-2 w-2 rounded-full bg-[#fb923c]" />
              Gasto variable
            </Button>
          </div>
          <p className="text-[10px] text-fg-subtle">
            Los fijos son los que se repiten todos los meses (suscripciones, alquiler). Los variables son
            consumo puntual.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={initial?.amount ?? ''}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as 'USD' | 'ARS')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="ARS">ARS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Categoría</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateCat((v) => !v)}
            className="h-6 px-2 text-[10px]"
          >
            <Plus className="h-3 w-3" />
            {showCreateCat ? 'Cancelar' : 'Nueva categoría'}
          </Button>
        </div>

        {showCreateCat ? (
          <div className="flex gap-2">
            <Input
              placeholder={
                type === 'income' ? 'Nombre (ej. Salario)' : expenseKind === 'fixed' ? 'Nombre (ej. Netflix)' : 'Nombre (ej. Uber)'
              }
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onCreateCategory();
                }
              }}
              autoFocus
            />
            <Button type="button" onClick={onCreateCategory} disabled={creatingCat || !newCatName.trim()}>
              {creatingCat ? '…' : 'Crear'}
            </Button>
          </div>
        ) : (
          <>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    filteredCategories.length === 0
                      ? `No hay categorías ${type === 'income' ? 'de ingreso' : expenseKind === 'fixed' ? 'fijas' : 'variables'}`
                      : 'Elegí una categoría'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredCategories.length === 0 ? (
              <p className="text-[10px] text-warning">
                No tenés categorías {type === 'income' ? 'de ingreso' : expenseKind === 'fixed' ? 'fijas' : 'variables'}. Creá una con
                {' '}
                <span className="font-semibold">"Nueva categoría"</span> arriba
                {type === 'expense'
                  ? ` o cambiá a ${expenseKind === 'fixed' ? 'variables' : 'fijos'} si te equivocaste de tipo.`
                  : '.'}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" name="note" defaultValue={initial?.note ?? ''} rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending || !categoryId}>
          {pending ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </div>
    </form>
  );
}
