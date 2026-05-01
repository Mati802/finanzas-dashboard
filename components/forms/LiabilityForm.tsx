'use client';

import * as React from 'react';
import { upsertLiability } from '@/app/actions/liabilities';
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
import type { Currency } from '@/lib/types';

export interface LiabilityFormProps {
  initial?: {
    id?: number;
    name?: string;
    amount?: number;
    currency?: Currency;
    dueDate?: string | null;
    note?: string | null;
  };
  onDone?: () => void;
}

export function LiabilityForm({ initial, onDone }: LiabilityFormProps) {
  const { toast } = useToast();
  const [currency, setCurrency] = React.useState<Currency>(initial?.currency ?? 'USD');
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('currency', currency);
    setPending(true);
    try {
      await upsertLiability(fd);
      toast({ title: initial?.id ? 'Deuda actualizada' : 'Deuda agregada' });
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

      <div className="space-y-1.5">
        <Label htmlFor="name">Descripción</Label>
        <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
      </div>

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

      <div className="space-y-1.5">
        <Label htmlFor="dueDate">Vencimiento (opcional)</Label>
        <Input
          id="dueDate"
          name="dueDate"
          type="date"
          defaultValue={initial?.dueDate ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" name="note" defaultValue={initial?.note ?? ''} rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </div>
    </form>
  );
}
