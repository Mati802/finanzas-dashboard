'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadBackup, restoreBackup } from '@/app/actions/backup';
import { useToast } from '@/components/ui/use-toast';

export function SettingsBackup() {
  const router = useRouter();
  const { toast } = useToast();
  const [downloading, setDownloading] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  async function onDownload() {
    setDownloading(true);
    try {
      const { filename, data } = await downloadBackup();
      // Decode base64 back to bytes.
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Backup descargado', description: filename });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo descargar',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  }

  async function onRestore(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      toast({ title: 'Seleccioná un archivo .db', variant: 'destructive' });
      return;
    }
    if (
      !confirm(
        'Esto reemplazará la base de datos actual. Se guardará una copia del estado previo. ¿Continuar?'
      )
    ) {
      return;
    }
    setRestoring(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      await restoreBackup(fd);
      toast({ title: 'Base restaurada', description: 'La página se recargará para reflejar los cambios.' });
      setFile(null);
      // Refresh after a short delay so the toast is visible.
      setTimeout(() => router.refresh(), 800);
    } catch (err) {
      toast({
        title: 'Error al restaurar',
        description: err instanceof Error ? err.message : 'No se pudo restaurar',
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Descargar backup</h3>
        <p className="text-[11px] text-fg-muted">
          Descarga el archivo SQLite completo con todas tus transacciones, activos y configuración.
        </p>
        <Button onClick={onDownload} disabled={downloading}>
          <Download className="h-3.5 w-3.5" />
          {downloading ? 'Generando…' : 'Descargar finanzas.db'}
        </Button>
      </section>

      <div className="border-t border-border-subtle" />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Restaurar desde backup</h3>
        <div className="flex items-start gap-2 rounded bg-warning/10 p-2.5 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Esto reemplazará la base actual. Se guardará una copia con el nombre{' '}
            <code className="text-[10px]">finanzas.db.prev-&lt;timestamp&gt;</code> por seguridad.
          </span>
        </div>
        <form onSubmit={onRestore} className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="dbfile">Archivo .db</Label>
            <Input
              id="dbfile"
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" disabled={!file || restoring} variant="destructive">
            <Upload className="h-3.5 w-3.5" />
            {restoring ? 'Restaurando…' : 'Restaurar'}
          </Button>
        </form>
      </section>
    </div>
  );
}
