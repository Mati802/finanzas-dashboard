'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateDefaultRate } from '@/app/actions/settings';
import { useToast } from '@/components/ui/use-toast';
import { RATE_TYPES, RATE_LABELS } from '@/lib/types';
import type { RateType } from '@/lib/types';

export interface SettingsGeneralProps {
  defaultRateType: RateType;
  onSaved: () => void;
}

export function SettingsGeneral({ defaultRateType, onSaved }: SettingsGeneralProps) {
  const { toast } = useToast();
  const [value, setValue] = React.useState<RateType>(defaultRateType);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const fd = new FormData();
      fd.set('value', value);
      await updateDefaultRate(fd);
      toast({ title: 'Tasa default actualizada' });
      onSaved();
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
    <form onSubmit={onSubmit} className="flex items-end gap-3">
      <div className="space-y-1.5">
        <Label>Tipo de cotización default</Label>
        <Select value={value} onValueChange={(v) => setValue(v as RateType)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATE_TYPES.map((r) => (
              <SelectItem key={r} value={r}>
                {RATE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
