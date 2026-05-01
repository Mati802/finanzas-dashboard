'use client';

import * as React from 'react';
import { upsertAsset } from '@/app/actions/assets';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { AssetKind, AssetType, Currency, PriceSource } from '@/lib/types';
import { ASSET_TYPE_LABELS } from '@/lib/types';
import { CEDEAR_LIST } from '@/lib/rates/cedears';
import { CRYPTO_LIST } from '@/lib/rates/crypto-list';

export interface AssetFormProps {
  /** Determina dónde aparece el activo: wallet (Patrimonio Cuentas),
   * investment (Inversiones, CEDEAR/cripto) o object (Patrimonio Objetos). */
  kind?: AssetKind;
  initial?: {
    id?: number;
    name?: string;
    type?: AssetType;
    quantity?: number;
    ticker?: string | null;
    priceSource?: PriceSource | null;
    manualValue?: number | null;
    currency?: Currency;
  };
  onDone?: () => void;
}

// Sub-set de tipos disponibles según el kind del activo. Esto guía al usuario
// y evita por ejemplo crear "auto" como tipo crypto.
const TYPES_BY_KIND: Record<AssetKind, AssetType[]> = {
  wallet: ['cash_usd', 'cash_ars', 'crypto', 'other'],
  investment: ['stock', 'crypto', 'other'],
  object: ['property', 'other'],
};

const DEFAULT_TYPE_BY_KIND: Record<AssetKind, AssetType> = {
  wallet: 'cash_usd',
  investment: 'stock',
  object: 'property',
};

export function AssetForm({ kind = 'investment', initial, onDone }: AssetFormProps) {
  const { toast } = useToast();
  const [type, setType] = React.useState<AssetType>(
    initial?.type ?? DEFAULT_TYPE_BY_KIND[kind]
  );
  const [currency, setCurrency] = React.useState<Currency>(initial?.currency ?? 'USD');
  const [ticker, setTicker] = React.useState<string>(initial?.ticker ?? '');
  const [name, setName] = React.useState<string>(initial?.name ?? '');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (type === 'cash_ars') setCurrency('ARS');
    else if (type === 'cash_usd') setCurrency('USD');
    // CEDEARs cotizan en ARS por definición.
    else if (kind === 'investment' && type === 'stock') setCurrency('ARS');
    else if (kind === 'investment' && type === 'crypto') setCurrency('USD');
  }, [type, kind]);

  // Cuando es una inversión y el usuario elige un ticker conocido, autocompleto
  // el nombre con la descripción humana (ej. "NVDA" → "NVIDIA"). Solo si el
  // usuario no escribió un nombre propio aún.
  function pickInvestment(t: AssetType, sym: string) {
    setTicker(sym);
    if (t === 'stock') {
      const meta = CEDEAR_LIST.find((c) => c.symbol === sym);
      if (meta) setName(`${meta.name} (CEDEAR ${meta.symbol})`);
    } else if (t === 'crypto') {
      const meta = CRYPTO_LIST.find((c) => c.symbol === sym);
      if (meta) setName(meta.name);
    }
  }

  const availableTypes = TYPES_BY_KIND[kind];

  // Tipos que pueden tener ticker. Para investment siempre lo mostramos
  // (es la columna principal). Para wallet solo si es crypto.
  const showTicker =
    kind === 'investment' ? true : type === 'crypto' || type === 'stock' || type === 'other';
  // El valor manual aparece en objetos siempre (no hay precio de mercado),
  // en wallets como saldo manual (cash sin ticker), y en investment como
  // fallback si no hay precio en vivo aún.
  const showManualValue =
    kind === 'object' ||
    (kind === 'wallet' && (type === 'cash_usd' || type === 'cash_ars')) ||
    (kind === 'investment' && !ticker.trim()) ||
    type === 'property';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('type', type);
    fd.set('currency', currency);
    fd.set('kind', kind);
    setPending(true);
    try {
      await upsertAsset(fd);
      toast({ title: initial?.id ? 'Activo actualizado' : 'Activo agregado' });
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
          <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {ASSET_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
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

      {/* Para inversiones (CEDEAR / cripto) usamos un Select con la lista
          curada en lugar del ticker libre. Eso autocompleta el nombre y
          asegura que el símbolo matchee con la fuente de precios. */}
      {kind === 'investment' && type === 'stock' ? (
        <div className="space-y-1.5">
          <Label>Empresa (CEDEAR)</Label>
          <Select value={ticker} onValueChange={(v) => pickInvestment('stock', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí la empresa…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {CEDEAR_LIST.map((c) => (
                <SelectItem key={c.symbol} value={c.symbol}>
                  {c.symbol} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {kind === 'investment' && type === 'crypto' ? (
        <div className="space-y-1.5">
          <Label>Criptomoneda</Label>
          <Select value={ticker} onValueChange={(v) => pickInvestment('crypto', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí la cripto…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {CRYPTO_LIST.map((c) => (
                <SelectItem key={c.symbol} value={c.symbol}>
                  {c.symbol} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            kind === 'investment'
              ? 'Se autocompleta al elegir un activo'
              : kind === 'object'
                ? 'Auto, casa…'
                : 'Banco / wallet…'
          }
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantity">
            {kind === 'investment' && type === 'stock'
              ? 'Nominales'
              : kind === 'investment' && type === 'crypto'
                ? 'Cantidad de tokens'
                : 'Cantidad'}
          </Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            step="0.00000001"
            min="0"
            defaultValue={initial?.quantity ?? ''}
            required
          />
        </div>
        {showTicker && kind !== 'investment' ? (
          <div className="space-y-1.5">
            <Label htmlFor="ticker">Ticker</Label>
            <Input
              id="ticker"
              name="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder={type === 'crypto' ? 'USDT, BTC…' : 'Símbolo (si aplica)'}
            />
          </div>
        ) : null}
      </div>

      {/* Hidden ticker — para investment lo manejamos vía Select arriba.
          Lo enviamos como hidden para que llegue al server action. */}
      {kind === 'investment' && (type === 'stock' || type === 'crypto') ? (
        <input type="hidden" name="ticker" value={ticker} />
      ) : null}

      {showManualValue ? (
        <div className="space-y-1.5">
          <Label htmlFor="manualValue">
            Valor total {ticker.trim() ? '(fallback si CMC no tiene datos)' : ''}
          </Label>
          <Input
            id="manualValue"
            name="manualValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.manualValue ?? ''}
          />
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </div>
    </form>
  );
}
