'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  updateTickerItemVisibility,
  reorderTickerItems,
  createTickerItem,
  deleteTickerItem,
} from '@/app/actions/settings';
import { useToast } from '@/components/ui/use-toast';
import type { TickerItemRow } from '../AjustesView';
import type { TickerSourceType } from '@/lib/types';

export interface SettingsTickerProps {
  items: TickerItemRow[];
  onChanged: () => void;
}

const SOURCE_TYPE_LABELS: Record<TickerSourceType, string> = {
  fx_ars: 'Dólar ARS (oficial/blue/MEP/CCL/USDT)',
  fx_usd: 'Moneda extranjera (USD→X)',
  crypto: 'Cripto (BTC, ETH, ADA, SOL…)',
  stock: 'Acción (AAPL, TSLA, GOOGL…)',
  index: 'Índice bursátil (^GSPC, ^DJI…)',
};

const SOURCE_KEY_HINTS: Record<TickerSourceType, string> = {
  fx_ars: 'oficial · blue · mep · ccl · usdt',
  fx_usd: 'p. ej. EUR, BRL (aún no conectado)',
  crypto: 'Símbolo CMC: BTC, ETH, ADA',
  stock: 'Ticker Yahoo: AAPL, MSFT, TSLA',
  index: 'Ticker Yahoo: ^GSPC, ^DJI, ^IXIC',
};

export function SettingsTicker({ items, onChanged }: SettingsTickerProps) {
  const { toast } = useToast();
  const [ordered, setOrdered] = React.useState<TickerItemRow[]>(() => [...items]);
  const [showAdd, setShowAdd] = React.useState(false);
  const [displayLabel, setDisplayLabel] = React.useState('');
  const [sourceType, setSourceType] = React.useState<TickerSourceType>('crypto');
  const [sourceKey, setSourceKey] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Keep local state in sync when server data changes.
  React.useEffect(() => {
    setOrdered([...items]);
  }, [items]);

  async function persistOrder(next: TickerItemRow[]) {
    setOrdered(next);
    try {
      await reorderTickerItems(next.map((n) => n.id));
      onChanged();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo reordenar',
        variant: 'destructive',
      });
    }
  }

  function move(idx: number, delta: number) {
    const next = [...ordered];
    const t = idx + delta;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    void persistOrder(next);
  }

  async function toggle(item: TickerItemRow) {
    try {
      await updateTickerItemVisibility(item.id, !item.isVisible);
      onChanged();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo actualizar',
        variant: 'destructive',
      });
    }
  }

  async function onDelete(id: number) {
    try {
      await deleteTickerItem(id);
      onChanged();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createTickerItem({ displayLabel, sourceType, sourceKey });
      setDisplayLabel('');
      setSourceKey('');
      setShowAdd(false);
      onChanged();
      toast({ title: 'Listo', description: 'Nuevo ítem agregado al ticker.' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo crear',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="text-xs text-fg-muted">
          Arrastrá con los botones para reordenar. Cualquier activo financiero puede agregarse.
        </div>
        <Button size="sm" variant={showAdd ? 'outline' : 'secondary'} onClick={() => setShowAdd((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          {showAdd ? 'Cancelar' : 'Agregar activo'}
        </Button>
      </div>

      {showAdd && (
        <form
          onSubmit={onCreate}
          className="grid gap-3 border-b border-border-subtle bg-bg-sunken px-4 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <div className="space-y-1">
            <Label htmlFor="tk-label">Etiqueta</Label>
            <Input
              id="tk-label"
              placeholder="BTC/USD"
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tk-type">Tipo</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as TickerSourceType)}>
              <SelectTrigger id="tk-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SOURCE_TYPE_LABELS) as TickerSourceType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SOURCE_TYPE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tk-key">Clave</Label>
            <Input
              id="tk-key"
              placeholder={SOURCE_KEY_HINTS[sourceType]}
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value)}
              required
            />
            <div className="text-[10px] text-fg-subtle">{SOURCE_KEY_HINTS[sourceType]}</div>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Agregar'}
            </Button>
          </div>
        </form>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">Orden</TableHead>
            <TableHead>Etiqueta</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Clave</TableHead>
            <TableHead className="w-[120px]">Visible</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-xs text-fg-subtle">
                No hay ítems en el ticker.
              </TableCell>
            </TableRow>
          ) : (
            ordered.map((t, i) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(i, 1)}
                      disabled={i === ordered.length - 1}
                      aria-label="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{t.displayLabel}</TableCell>
                <TableCell className="text-fg-muted">{t.sourceType}</TableCell>
                <TableCell className="text-fg-muted">{t.sourceKey}</TableCell>
                <TableCell>
                  <Button
                    variant={t.isVisible ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => toggle(t)}
                  >
                    {t.isVisible ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Mostrar
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Oculto
                      </>
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar"
                    onClick={() => onDelete(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
