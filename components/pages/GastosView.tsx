'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionForm, type CategoryOption } from '@/components/forms/TransactionForm';
import { deleteTransaction } from '@/app/actions/transactions';
import { listCategories } from '@/app/actions/categories';
import { useToast } from '@/components/ui/use-toast';
import { formatMoney, formatDateShort, formatMonthName } from '@/lib/format';
import type { TransactionWithCategory } from '@/lib/queries/transactions';

export interface GastosViewProps {
  year: number;
  month: number;
  expenses: TransactionWithCategory[];
  missingRecurring: Array<{ id: number; name: string; color: string }>;
}

function kindLabel(kind: string) {
  if (kind === 'fixed') return 'Fijo';
  if (kind === 'variable') return 'Variable';
  return kind;
}

export function GastosView({ year, month, expenses, missingRecurring }: GastosViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<TransactionWithCategory | null>(null);
  const [categories, setCategories] = React.useState<CategoryOption[] | null>(null);

  // Re-fetcheamos siempre que se abre el editor para que aparezcan las
  // categorías recién creadas (en Ajustes o desde el form inline).
  React.useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    listCategories().then((rows) => {
      if (!cancelled) {
        setCategories(rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editing]);

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    router.push(`/gastos?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }
  function nextMonth() {
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() + 1);
    router.push(`/gastos?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  async function onDelete(id: number) {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await deleteTransaction(id);
      toast({ title: 'Gasto eliminado' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  }

  const fixed = expenses.filter((e) => e.category.kind === 'fixed');
  const variable = expenses.filter((e) => e.category.kind === 'variable');

  const fixedTotal = fixed.reduce((s, t) => s + Number(t.amount), 0);
  const variableTotal = variable.reduce((s, t) => s + Number(t.amount), 0);

  function renderTable(rows: TransactionWithCategory[]) {
    if (rows.length === 0) {
      return (
        <div className="px-4 py-10 text-center text-xs text-fg-subtle">
          Sin gastos en esta sección.
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Nota</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="tabular-num">{formatDateShort(t.date)}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: t.category.color }}
                  />
                  {t.category.name}
                  <span className="text-[9px] uppercase tracking-wide text-fg-subtle">
                    {kindLabel(t.category.kind)}
                  </span>
                </span>
              </TableCell>
              <TableCell className="max-w-[260px] truncate text-fg-muted">
                {t.note ?? '—'}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-num text-negative">
                −{formatMoney(t.amount, t.currency)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(t)}
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(t.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Mes anterior">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-[140px] text-center text-xs font-semibold capitalize">
              {formatMonthName(month, year)} {year}
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Mes siguiente">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-fg-subtle">
              Fijos:{' '}
              <span className="font-semibold text-fg tabular-num">
                {formatMoney(fixedTotal, 'USD')}
              </span>
            </span>
            <span className="text-fg-subtle">
              Variables:{' '}
              <span className="font-semibold text-fg tabular-num">
                {formatMoney(variableTotal, 'USD')}
              </span>
            </span>
          </div>
        </div>

        {missingRecurring.length > 0 ? (
          <div className="flex items-start gap-2 border-b border-border-subtle bg-warning/10 px-4 py-2.5 text-[11px] text-warning">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <div className="font-semibold">Categorías recurrentes sin pagar este mes:</div>
              <div className="mt-0.5 text-fg-muted">
                {missingRecurring.map((c) => c.name).join(' · ')}
              </div>
            </div>
          </div>
        ) : null}

        <CardContent className="p-0">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border-subtle bg-transparent p-0">
              <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent">
                Todos ({expenses.length})
              </TabsTrigger>
              <TabsTrigger value="fixed" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent">
                Fijos ({fixed.length})
              </TabsTrigger>
              <TabsTrigger value="variable" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent">
                Variables ({variable.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-0">
              {renderTable(expenses)}
            </TabsContent>
            <TabsContent value="fixed" className="mt-0">
              {renderTable(fixed)}
            </TabsContent>
            <TabsContent value="variable" className="mt-0">
              {renderTable(variable)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
            <DialogDescription>Modificá los datos y guardá.</DialogDescription>
          </DialogHeader>
          {editing && categories ? (
            <TransactionForm
              categories={categories}
              initial={{
                id: editing.id,
                date: editing.date.toISOString().slice(0, 10),
                type: editing.type,
                amount: editing.amount,
                currency: editing.currency,
                categoryId: editing.categoryId,
                note: editing.note ?? '',
              }}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          ) : (
            <div className="py-6 text-center text-xs text-fg-subtle">Cargando…</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
