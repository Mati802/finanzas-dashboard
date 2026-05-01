'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { AssetForm } from '@/components/forms/AssetForm';
import { deleteAsset, refreshAssetPrices } from '@/app/actions/assets';
import { refreshCedears } from '@/app/actions/cedears';
import { useToast } from '@/components/ui/use-toast';
import { formatUSD, formatARS, formatPct, formatNumber, formatMoney } from '@/lib/format';
import { ASSET_TYPE_LABELS } from '@/lib/types';
import type { AssetType, Currency, PriceSource } from '@/lib/types';

export interface InversionesAsset {
  id: number;
  name: string;
  type: AssetType;
  ticker: string | null;
  priceSource: PriceSource | null;
  quantity: number;
  currency: Currency;
  manualValue: number | null;
  unitPrice: number;
  valueUsd: number;
  valueNative: number;
  change24h: number;
}

export interface CedearQuoteRow {
  symbol: string;
  yahooSymbol: string;
  name: string;
  sector: string;
  priceArs: number;
  priceUsd: number;
  changePct24h: number;
  fetchedAt: string | null;
}

export interface InversionesViewProps {
  initial: InversionesAsset[];
  totalUsd: number;
  totalCryptoUsd: number;
  totalCedearArs: number;
  cedears: CedearQuoteRow[];
}

export function InversionesView({
  initial,
  totalUsd,
  totalCryptoUsd,
  totalCedearArs,
  cedears,
}: InversionesViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InversionesAsset | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshingCedears, setRefreshingCedears] = React.useState(false);
  const [cedearQuery, setCedearQuery] = React.useState('');
  const [cedearSector, setCedearSector] = React.useState<string>('all');

  const cedearSectors = React.useMemo(() => {
    const s = new Set<string>();
    for (const c of cedears) s.add(c.sector);
    return ['all', ...Array.from(s).sort()];
  }, [cedears]);

  const filteredCedears = React.useMemo(() => {
    const q = cedearQuery.trim().toLowerCase();
    return cedears
      .filter((c) => (cedearSector === 'all' ? true : c.sector === cedearSector))
      .filter((c) =>
        q ? c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) : true
      )
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [cedears, cedearQuery, cedearSector]);

  const cedearsLastFetched = React.useMemo(() => {
    let max: number | null = null;
    for (const c of cedears) {
      if (!c.fetchedAt) continue;
      const t = new Date(c.fetchedAt).getTime();
      if (max == null || t > max) max = t;
    }
    return max ? new Date(max) : null;
  }, [cedears]);

  async function onRefreshCedears() {
    setRefreshingCedears(true);
    try {
      await refreshCedears();
      toast({ title: 'CEDEARs actualizados' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudieron actualizar',
        variant: 'destructive',
      });
    } finally {
      setRefreshingCedears(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshAssetPrices();
      toast({ title: 'Precios actualizados' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudieron actualizar',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm('¿Eliminar este activo?')) return;
    try {
      await deleteAsset(id);
      toast({ title: 'Activo eliminado' });
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
      {/* KPI subtotales por clase de activo */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <Card className="glass">
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
              Total inversiones
            </div>
            <div className="text-2xl font-bold tabular-num">{formatUSD(totalUsd)}</div>
          </CardContent>
        </Card>
        <Card className="glass-green">
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Cripto</div>
            <div className="text-2xl font-bold tabular-num">{formatUSD(totalCryptoUsd)}</div>
            <div className="text-[11px] text-fg-subtle">Valuado en USD vía CMC</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">CEDEARs</div>
            <div className="text-2xl font-bold tabular-num">{formatARS(totalCedearArs)}</div>
            <div className="text-[11px] text-fg-subtle">Valuado en ARS vía Yahoo .BA</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">Posiciones</div>
            <div className="mt-0.5 text-lg font-bold tabular-num">{formatUSD(totalUsd)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando…' : 'Actualizar precios'}
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar activo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo activo</DialogTitle>
                  <DialogDescription>
                    Tenencia de efectivo, cripto, acciones o propiedades.
                  </DialogDescription>
                </DialogHeader>
                <AssetForm kind="investment" onDone={() => setAddOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <CardContent className="p-0">
          {initial.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-fg-subtle">
              Aún no registraste ningún activo.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio unit.</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Valor (USD)</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-semibold">{a.name}</div>
                      {a.ticker ? (
                        <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
                          {a.ticker}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-fg-muted">{ASSET_TYPE_LABELS[a.type]}</TableCell>
                    <TableCell className="text-right tabular-num">
                      {formatNumber(a.quantity, a.type === 'crypto' ? 6 : 2)}
                    </TableCell>
                    <TableCell className="text-right tabular-num">
                      {a.unitPrice > 0 ? formatMoney(a.unitPrice, a.currency) : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right text-[11px] tabular-num ${
                        a.change24h > 0
                          ? 'text-positive'
                          : a.change24h < 0
                            ? 'text-negative'
                            : 'text-fg-subtle'
                      }`}
                    >
                      {a.change24h !== 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          {a.change24h > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatPct(a.change24h)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-num">
                      {formatMoney(a.valueNative, a.currency)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-num">
                      {formatUSD(a.valueUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(a)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(a.id)}
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

      {/* Cotizaciones CEDEARs (BYMA, vía Yahoo .BA) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
              Cotizaciones CEDEARs
            </div>
            <div className="mt-0.5 text-[11px] text-fg-muted">
              {cedears.length} tickers · BYMA en ARS · USD vía cotización default
              {cedearsLastFetched
                ? ` · actualizado ${cedearsLastFetched.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={cedearQuery}
              onChange={(e) => setCedearQuery(e.target.value)}
              placeholder="Buscar ticker o empresa…"
              className="h-7 w-44 rounded border border-border-subtle bg-transparent px-2 text-[11px] outline-none focus:border-fg-muted"
            />
            <select
              value={cedearSector}
              onChange={(e) => setCedearSector(e.target.value)}
              className="h-7 rounded border border-border-subtle bg-transparent px-1.5 text-[11px] outline-none focus:border-fg-muted"
            >
              {cedearSectors.map((s) => (
                <option key={s} value={s} className="bg-[#0c0c10] text-[#e4e4e7]">
                  {s === 'all' ? 'Todos' : s}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={onRefreshCedears} disabled={refreshingCedears}>
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshingCedears ? 'animate-spin' : ''}`}
              />
              {refreshingCedears ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {filteredCedears.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-fg-subtle">
              {cedears.length === 0
                ? 'No hay cotizaciones todavía. Apretá "Actualizar" para traer las primeras.'
                : 'Ningún CEDEAR coincide con los filtros.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Precio (ARS)</TableHead>
                  <TableHead className="text-right">Precio (USD)</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCedears.map((c) => (
                  <TableRow key={c.symbol}>
                    <TableCell>
                      <div className="font-semibold uppercase">{c.symbol}</div>
                      <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
                        {c.yahooSymbol}
                      </div>
                    </TableCell>
                    <TableCell className="text-fg-muted">{c.name}</TableCell>
                    <TableCell>
                      <span className="rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                        {c.sector}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-num">
                      {c.priceArs > 0 ? formatARS(c.priceArs) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-num">
                      {c.priceUsd > 0 ? formatUSD(c.priceUsd) : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right text-[11px] tabular-num ${
                        c.changePct24h > 0
                          ? 'text-positive'
                          : c.changePct24h < 0
                            ? 'text-negative'
                            : 'text-fg-subtle'
                      }`}
                    >
                      {c.changePct24h !== 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          {c.changePct24h > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatPct(c.changePct24h)}
                        </span>
                      ) : (
                        '—'
                      )}
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
            <DialogTitle>Editar activo</DialogTitle>
            <DialogDescription>Actualizá los datos del activo.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <AssetForm
              kind="investment"
              initial={{
                id: editing.id,
                name: editing.name,
                type: editing.type,
                quantity: editing.quantity,
                ticker: editing.ticker,
                priceSource: editing.priceSource,
                manualValue: editing.manualValue,
                currency: editing.currency,
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
