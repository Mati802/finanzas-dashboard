'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { LiabilityForm } from '@/components/forms/LiabilityForm';
import { AssetForm } from '@/components/forms/AssetForm';
import { deleteLiability } from '@/app/actions/liabilities';
import { deleteAsset } from '@/app/actions/assets';
import { useToast } from '@/components/ui/use-toast';
import { formatUSD, formatMoney, formatDateShort, formatPct, formatCompactUsd } from '@/lib/format';
import type { Currency, RateType } from '@/lib/types';

export interface HistoryPoint {
  date: string;
  valueUsd: number;
  assetsUsd: number;
  liabilitiesUsd: number;
}

export interface LiabilityRow {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  dueDate: string | null;
  note: string | null;
}

export interface AssetBreakdownSlice {
  type: string;
  label: string;
  valueUsd: number;
  pct: number;
  color: string;
}

export interface AccountRow {
  id: number;
  name: string;
  type: string;
  ticker: string | null;
  currency: Currency;
  quantity: number;
  valueNative: number;
  valueUsd: number;
}

export interface ObjectRow {
  id: number;
  name: string;
  type: string;
  currency: Currency;
  quantity: number;
  valueNative: number;
  valueUsd: number;
}

export interface PatrimonioViewProps {
  netWorth: {
    assetsUsd: number;
    liabilitiesUsd: number;
    netWorthUsd: number;
    rateType: RateType;
    exchangeRateUsed: number;
  };
  history: HistoryPoint[];
  assetBreakdown: AssetBreakdownSlice[];
  totalAssetsUsd: number;
  accounts: AccountRow[];
  objects: ObjectRow[];
  liabilities: LiabilityRow[];
}

async function takeSnapshotNow() {
  // Dynamic import to avoid bundling server-only code.
  const res = await fetch('/api/snapshot', { method: 'POST' });
  if (!res.ok) throw new Error('No se pudo generar el snapshot');
  return res.json();
}

const ACCOUNT_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  cash_usd: { label: 'USD', cls: 'bg-positive/10 text-positive' },
  cash_ars: { label: 'ARS', cls: 'bg-cyan-400/10 text-cyan-300' },
  crypto: { label: 'Cripto', cls: 'bg-orange-400/10 text-orange-300' },
  stock: { label: 'Acción', cls: 'bg-violet-400/10 text-violet-300' },
  property: { label: 'Propiedad', cls: 'bg-violet-500/10 text-violet-300' },
  other: { label: 'Otro', cls: 'bg-zinc-500/10 text-zinc-300' },
};

export function PatrimonioView({
  netWorth,
  history,
  assetBreakdown,
  totalAssetsUsd,
  accounts,
  objects,
  liabilities,
}: PatrimonioViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LiabilityRow | null>(null);
  const [snapping, setSnapping] = React.useState(false);
  const [addAccountOpen, setAddAccountOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<AccountRow | null>(null);
  const [addObjectOpen, setAddObjectOpen] = React.useState(false);
  const [editingObject, setEditingObject] = React.useState<ObjectRow | null>(null);

  async function onDeleteAsset(id: number, kind: 'cuenta' | 'objeto') {
    if (!confirm(`¿Eliminar este ${kind}?`)) return;
    try {
      await deleteAsset(id);
      toast({ title: kind === 'cuenta' ? 'Cuenta eliminada' : 'Objeto eliminado' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  }

  const totalAccountsUsd = accounts.reduce((s, a) => s + a.valueUsd, 0);
  const totalObjectsUsd = objects.reduce((s, a) => s + a.valueUsd, 0);

  async function onSnap() {
    setSnapping(true);
    try {
      await takeSnapshotNow();
      toast({ title: 'Snapshot generado' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo generar',
        variant: 'destructive',
      });
    } finally {
      setSnapping(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm('¿Eliminar esta deuda?')) return;
    try {
      await deleteLiability(id);
      toast({ title: 'Deuda eliminada' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  }

  // Previous (penultimate) month snapshot to show trend.
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  const trendPct =
    prev && prev.valueUsd > 0 ? ((curr.valueUsd - prev.valueUsd) / prev.valueUsd) * 100 : null;

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <Card className="glass">
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Patrimonio neto</div>
            <div className="text-2xl font-bold tabular-num">{formatUSD(netWorth.netWorthUsd)}</div>
            {trendPct !== null ? (
              <div
                className={`text-[11px] font-medium tabular-num ${
                  trendPct >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatPct(trendPct)} vs mes anterior
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card className="glass-green">
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Activos</div>
            <div className="text-2xl font-bold tabular-num text-positive">
              {formatUSD(netWorth.assetsUsd)}
            </div>
            <div className="text-[11px] text-fg-subtle">
              Tasa {netWorth.rateType.toUpperCase()} · ${netWorth.exchangeRateUsed.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-red">
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Deudas</div>
            <div className="text-2xl font-bold tabular-num text-negative">
              {formatUSD(netWorth.liabilitiesUsd)}
            </div>
            <div className="text-[11px] text-fg-subtle">
              {liabilities.length} {liabilities.length === 1 ? 'deuda registrada' : 'deudas registradas'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History chart */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Evolución 24 meses</CardTitle>
            <CardDescription>Activos vs deudas vs patrimonio neto</CardDescription>
          </div>
          <Button variant="outline" onClick={onSnap} disabled={snapping}>
            <RefreshCw className={`h-3.5 w-3.5 ${snapping ? 'animate-spin' : ''}`} />
            {snapping ? 'Generando…' : 'Tomar snapshot'}
          </Button>
        </CardHeader>
        <CardContent className="pb-5 pr-5">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 5, bottom: 0, left: -15 }}>
                <defs>
                  <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="assets-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#17171f" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={{ stroke: '#17171f' }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCompactUsd}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a22',
                    border: '1px solid #2a2a32',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: '#71717a', fontSize: 10 }}
                  formatter={(v: number, name: string) => [formatUSD(v), name]}
                />
                <Area
                  type="monotone"
                  dataKey="assetsUsd"
                  name="Activos"
                  stroke="#4ade80"
                  strokeWidth={1.5}
                  fill="url(#assets-grad)"
                />
                <Area
                  type="monotone"
                  dataKey="valueUsd"
                  name="Patrimonio"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#nw-grad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Asset breakdown + liabilities table */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Composición de activos</CardTitle>
              <CardDescription>Por tipo · total {formatUSD(totalAssetsUsd)}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {assetBreakdown.length === 0 ? (
              <div className="py-10 text-center text-xs text-fg-subtle">
                Aún no registraste activos.
              </div>
            ) : (
              assetBreakdown.map((a) => (
                <div key={a.type} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: a.color }}
                      />
                      <span>{a.label}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-num">
                      <span className="font-semibold">{formatUSD(a.valueUsd)}</span>
                      <span className="text-fg-subtle">{a.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border-subtle">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${a.pct}%`, background: a.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Deudas</CardTitle>
              <CardDescription>Pasivos en USD y ARS</CardDescription>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva deuda</DialogTitle>
                  <DialogDescription>Registrá un préstamo o cuenta por pagar.</DialogDescription>
                </DialogHeader>
                <LiabilityForm onDone={() => setAddOpen(false)} />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            {liabilities.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-fg-subtle">
                Sin deudas registradas.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liabilities.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-semibold">{l.name}</div>
                        {l.note ? (
                          <div className="text-[10px] text-fg-subtle">{l.note}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {l.dueDate ? formatDateShort(l.dueDate) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-num text-negative">
                        {formatMoney(l.amount, l.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(l)}
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(l.id)}
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
      </div>

      {/* Cuentas — bancos y wallets */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cuentas</CardTitle>
            <CardDescription>
              Bancos y wallets · {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'} · total {formatUSD(totalAccountsUsd)}
            </CardDescription>
          </div>
          <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva cuenta</DialogTitle>
                <DialogDescription>Banco, billetera o wallet de cripto.</DialogDescription>
              </DialogHeader>
              <AssetForm kind="wallet" onDone={() => setAddAccountOpen(false)} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-fg-subtle">
              No hay cuentas registradas todavía.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Valor USD</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...accounts]
                  .sort((a, b) => b.valueUsd - a.valueUsd || a.name.localeCompare(b.name))
                  .map((a) => {
                    const badge = ACCOUNT_TYPE_BADGE[a.type] ?? ACCOUNT_TYPE_BADGE.other;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-semibold">{a.name}</div>
                          {a.ticker ? (
                            <div className="text-[10px] text-fg-subtle">{a.ticker}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-num text-fg-muted">
                          {a.type === 'crypto' || a.type === 'stock'
                            ? `${a.quantity.toLocaleString('es-AR', { maximumFractionDigits: 8 })}${a.ticker ? ` ${a.ticker}` : ''}`
                            : formatMoney(a.valueNative, a.currency)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-num">
                          {formatUSD(a.valueUsd)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingAccount(a)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteAsset(a.id, 'cuenta')}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Objetos — auto, propiedades, otros bienes */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Objetos y bienes</CardTitle>
            <CardDescription>
              Auto, propiedades, otros · {objects.length} {objects.length === 1 ? 'item' : 'items'} · total {formatUSD(totalObjectsUsd)}
            </CardDescription>
          </div>
          <Dialog open={addObjectOpen} onOpenChange={setAddObjectOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo objeto</DialogTitle>
                <DialogDescription>
                  Auto, propiedad o cualquier bien con valor estimado.
                </DialogDescription>
              </DialogHeader>
              <AssetForm kind="object" onDone={() => setAddObjectOpen(false)} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {objects.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-fg-subtle">
              Sin objetos registrados. Agregá tu auto, una propiedad u otros bienes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Valor USD</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...objects]
                  .sort((a, b) => b.valueUsd - a.valueUsd || a.name.localeCompare(b.name))
                  .map((o) => {
                    const badge = ACCOUNT_TYPE_BADGE[o.type] ?? ACCOUNT_TYPE_BADGE.other;
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div className="font-semibold">{o.name}</div>
                        </TableCell>
                        <TableCell>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-num text-fg-muted">
                          {formatMoney(o.valueNative, o.currency)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-num">
                          {formatUSD(o.valueUsd)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingObject(o)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteAsset(o.id, 'objeto')}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialogs para cuentas y objetos */}
      <Dialog open={!!editingAccount} onOpenChange={(o) => !o && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cuenta</DialogTitle>
            <DialogDescription>Actualizá el saldo o los datos.</DialogDescription>
          </DialogHeader>
          {editingAccount ? (
            <AssetForm
              kind="wallet"
              initial={{
                id: editingAccount.id,
                name: editingAccount.name,
                type: editingAccount.type as 'cash_usd' | 'cash_ars' | 'crypto' | 'stock' | 'property' | 'other',
                ticker: editingAccount.ticker,
                quantity: editingAccount.quantity,
                manualValue: editingAccount.valueNative,
                currency: editingAccount.currency,
              }}
              onDone={() => {
                setEditingAccount(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingObject} onOpenChange={(o) => !o && setEditingObject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar objeto</DialogTitle>
            <DialogDescription>Actualizá el valor estimado.</DialogDescription>
          </DialogHeader>
          {editingObject ? (
            <AssetForm
              kind="object"
              initial={{
                id: editingObject.id,
                name: editingObject.name,
                type: editingObject.type as 'cash_usd' | 'cash_ars' | 'crypto' | 'stock' | 'property' | 'other',
                quantity: editingObject.quantity,
                manualValue: editingObject.valueNative,
                currency: editingObject.currency,
              }}
              onDone={() => {
                setEditingObject(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar deuda</DialogTitle>
            <DialogDescription>Actualizá los detalles de la deuda.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <LiabilityForm
              initial={{
                id: editing.id,
                name: editing.name,
                amount: editing.amount,
                currency: editing.currency,
                dueDate: editing.dueDate,
                note: editing.note,
              }}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
