'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
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
import { formatMoney, formatDateShort } from '@/lib/format';
import type { TransactionWithCategory } from '@/lib/queries/transactions';

export interface IngresosTableProps {
  transactions: TransactionWithCategory[];
  year: number;
}

export function IngresosTable({ transactions, year }: IngresosTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<TransactionWithCategory | null>(null);
  const [categories, setCategories] = React.useState<CategoryOption[] | null>(null);

  React.useEffect(() => {
    if (!editing || categories) return;
    let cancelled = false;
    listCategories().then((rows) => {
      if (!cancelled) {
        setCategories(rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editing, categories]);

  async function onDelete(id: number) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    try {
      await deleteTransaction(id);
      toast({ title: 'Ingreso eliminado' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/ingresos?year=${year - 1}`)}
              aria-label="Año anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-[60px] text-center text-xs font-semibold">{year}</div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/ingresos?year=${year + 1}`)}
              aria-label="Año siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="text-[11px] text-fg-subtle">
            {transactions.length} {transactions.length === 1 ? 'ingreso' : 'ingresos'}
          </div>
        </div>

        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-fg-subtle">
              No hay ingresos registrados este año.
            </div>
          ) : (
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
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="tabular-num">{formatDateShort(t.date)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: t.category.color }}
                        />
                        {t.category.name}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-fg-muted">
                      {t.note ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-num text-positive">
                      +{formatMoney(t.amount, t.currency)}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar ingreso</DialogTitle>
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
