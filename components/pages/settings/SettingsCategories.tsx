'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { upsertCategory, deleteCategory } from '@/app/actions/categories';
import { useToast } from '@/components/ui/use-toast';
import type { Category } from '../AjustesView';

function kindLabel(k: string) {
  if (k === 'fixed') return 'Fijo';
  if (k === 'variable') return 'Variable';
  if (k === 'income') return 'Ingreso';
  return k;
}

function CategoryForm({
  initial,
  onDone,
}: {
  initial?: Partial<Category>;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [kind, setKind] = React.useState<string>(initial?.kind ?? 'variable');
  const [isRecurring, setIsRecurring] = React.useState<boolean>(initial?.isRecurring ?? false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('kind', kind);
    if (isRecurring) fd.set('isRecurring', 'on');
    else fd.delete('isRecurring');
    setPending(true);
    try {
      await upsertCategory(fd);
      toast({ title: initial?.id ? 'Categoría actualizada' : 'Categoría agregada' });
      onDone();
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
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fijo</SelectItem>
              <SelectItem value="variable">Variable</SelectItem>
              <SelectItem value="income">Ingreso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            name="color"
            type="color"
            defaultValue={initial?.color ?? '#71717a'}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="icon">Icono (lucide)</Label>
        <Input id="icon" name="icon" defaultValue={initial?.icon ?? 'tag'} />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Recurrente (avisar si falta este mes)
      </label>
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </div>
    </form>
  );
}

export interface SettingsCategoriesProps {
  categories: Category[];
}

export function SettingsCategories({ categories }: SettingsCategoriesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);

  async function onDelete(c: Category) {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    try {
      await deleteCategory(c.id);
      toast({ title: 'Categoría eliminada' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'No se puede eliminar',
        description: err instanceof Error ? err.message : 'Error al eliminar',
        variant: 'destructive',
      });
    }
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <div className="text-[11px] text-fg-subtle">{categories.length} categorías</div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva categoría</DialogTitle>
              <DialogDescription>Configurá nombre, tipo y color.</DialogDescription>
            </DialogHeader>
            <CategoryForm
              onDone={() => {
                setAddOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Recurrente</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
              </TableCell>
              <TableCell className="text-fg-muted">{kindLabel(c.kind)}</TableCell>
              <TableCell className="text-fg-muted">{c.isRecurring ? 'Sí' : 'No'}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(c)}
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(c)}
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
            <DialogDescription>Cambiá el nombre, tipo o color.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <CategoryForm
              initial={editing}
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
