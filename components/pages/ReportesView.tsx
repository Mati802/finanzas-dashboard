'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatUSD, formatMoney } from '@/lib/format';

export interface ReportRow {
  id: number;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  currency: 'USD' | 'ARS';
  amountUsd: number;
  categoryId: number;
  categoryName: string;
  categoryKind: string;
  note: string;
}

export interface ReportesViewProps {
  rows: ReportRow[];
  categories: Array<{ id: number; name: string; kind: string }>;
  from: string;
  to: string;
  year: number;
}

type GroupBy = 'category' | 'type' | 'month';

export function ReportesView({ rows, categories, from, to, year }: ReportesViewProps) {
  const router = useRouter();
  const [groupBy, setGroupBy] = React.useState<GroupBy>('category');
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && String(r.categoryId) !== categoryFilter) return false;
      return true;
    });
  }, [rows, typeFilter, categoryFilter]);

  interface Bucket {
    key: string;
    label: string;
    income: number;
    expense: number;
    count: number;
  }

  const groups = React.useMemo<Bucket[]>(() => {
    const map = new Map<string, Bucket>();
    for (const r of filtered) {
      let key: string;
      let label: string;
      if (groupBy === 'category') {
        key = String(r.categoryId);
        label = r.categoryName;
      } else if (groupBy === 'type') {
        key = r.type;
        label = r.type === 'income' ? 'Ingresos' : 'Gastos';
      } else {
        key = r.date.slice(0, 7);
        const [y, m] = key.split('-');
        label =
          new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric',
          });
      }
      const bucket = map.get(key) ?? { key, label, income: 0, expense: 0, count: 0 };
      if (r.type === 'income') bucket.income += r.amountUsd;
      else bucket.expense += r.amountUsd;
      bucket.count++;
      map.set(key, bucket);
    }
    const arr = Array.from(map.values());
    if (groupBy === 'month') arr.sort((a, b) => a.key.localeCompare(b.key));
    else arr.sort((a, b) => b.income + b.expense - (a.income + a.expense));
    return arr;
  }, [filtered, groupBy]);

  const totalIncome = filtered.filter((r) => r.type === 'income').reduce((s, r) => s + r.amountUsd, 0);
  const totalExpense = filtered.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amountUsd, 0);

  function onApply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = new URLSearchParams();
    q.set('from', String(fd.get('from') ?? from));
    q.set('to', String(fd.get('to') ?? to));
    q.set('year', String(year));
    router.push(`/reportes?${q.toString()}`);
  }

  function exportCsv() {
    const header = ['fecha', 'tipo', 'categoria', 'monto', 'moneda', 'monto_usd', 'nota'];
    const lines = [header.join(',')];
    for (const r of filtered) {
      const fields = [
        r.date,
        r.type,
        r.categoryName,
        r.amount.toFixed(2),
        r.currency,
        r.amountUsd.toFixed(2),
        r.note.replace(/"/g, '""'),
      ];
      lines.push(fields.map((f) => `"${f}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <form onSubmit={onApply} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from">Desde</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">Hasta</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Ingresos</SelectItem>
                  <SelectItem value="expense">Gastos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Agrupar por</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Categoría</SelectItem>
                  <SelectItem value="type">Tipo</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button type="submit" variant="secondary">
                Aplicar rango
              </Button>
              <Button type="button" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <Card className="glass-green">
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Ingresos</div>
            <div className="text-xl font-bold tabular-num text-positive">{formatUSD(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card className="glass-red">
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Gastos</div>
            <div className="text-xl font-bold tabular-num text-negative">{formatUSD(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card className={totalIncome - totalExpense >= 0 ? 'glass' : 'glass-orange'}>
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Saldo</div>
            <div className="text-xl font-bold tabular-num">
              {formatUSD(totalIncome - totalExpense)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              Resumen por{' '}
              {groupBy === 'category' ? 'categoría' : groupBy === 'type' ? 'tipo' : 'mes'}
            </CardTitle>
            <CardDescription>
              {filtered.length} {filtered.length === 1 ? 'transacción' : 'transacciones'} en el rango
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-fg-subtle">
              No hay datos para los filtros aplicados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupBy === 'category' ? 'Categoría' : groupBy === 'type' ? 'Tipo' : 'Mes'}</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right"># Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="font-semibold capitalize">{g.label}</TableCell>
                    <TableCell className="text-right tabular-num text-positive">
                      {g.income > 0 ? formatUSD(g.income) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-num text-negative">
                      {g.expense > 0 ? formatUSD(g.expense) : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-num ${
                        g.income - g.expense >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {formatUSD(g.income - g.expense)}
                    </TableCell>
                    <TableCell className="text-right tabular-num text-fg-muted">
                      {g.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-num text-positive">
                    {formatUSD(totalIncome)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-num text-negative">
                    {formatUSD(totalExpense)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-num ${
                      totalIncome - totalExpense >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {formatUSD(totalIncome - totalExpense)}
                  </TableCell>
                  <TableCell className="text-right tabular-num">{filtered.length}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Detalle de transacciones</CardTitle>
            <CardDescription>Últimas {Math.min(filtered.length, 100)} en rango</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-fg-subtle">Sin transacciones.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(-100).reverse().map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-num">{r.date}</TableCell>
                    <TableCell>
                      <span
                        className={
                          r.type === 'income'
                            ? 'rounded bg-positive/15 px-1.5 py-0.5 text-[10px] font-medium text-positive'
                            : 'rounded bg-negative/15 px-1.5 py-0.5 text-[10px] font-medium text-negative'
                        }
                      >
                        {r.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </TableCell>
                    <TableCell>{r.categoryName}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-fg-muted">
                      {r.note || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-num">
                      {formatMoney(r.amount, r.currency)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-num">
                      {formatUSD(r.amountUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
