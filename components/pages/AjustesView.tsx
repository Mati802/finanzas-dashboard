'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsGeneral } from './settings/SettingsGeneral';
import { SettingsCategories } from './settings/SettingsCategories';
import { SettingsTicker } from './settings/SettingsTicker';
import { SettingsBackup } from './settings/SettingsBackup';
import type { RateType } from '@/lib/types';

export interface Category {
  id: number;
  name: string;
  kind: string;
  icon: string;
  color: string;
  isRecurring: boolean;
}

export interface TickerItemRow {
  id: number;
  displayLabel: string;
  sourceType: string;
  sourceKey: string;
  orderIndex: number;
  isVisible: boolean;
}

export interface AjustesViewProps {
  defaultRateType: RateType;
  categories: Category[];
  tickerItems: TickerItemRow[];
}

export function AjustesView({ defaultRateType, categories, tickerItems }: AjustesViewProps) {
  const router = useRouter();

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="categorias">Categorías</TabsTrigger>
        <TabsTrigger value="ticker">Ticker</TabsTrigger>
        <TabsTrigger value="backup">Backup</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Configuración general</CardTitle>
              <CardDescription>
                Elegí qué tipo de cotización se usa por default para convertir ARS a USD.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SettingsGeneral defaultRateType={defaultRateType} onSaved={() => router.refresh()} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="categorias">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Categorías</CardTitle>
              <CardDescription>
                Creá, editá o eliminá categorías. Las marcadas como recurrentes se vigilan en Gastos.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <SettingsCategories categories={categories} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ticker">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ticker superior</CardTitle>
              <CardDescription>
                Reordená y mostrá/ocultá ítems del ticker que aparece en todas las páginas.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <SettingsTicker items={tickerItems} onChanged={() => router.refresh()} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="backup">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Backup y restauración</CardTitle>
              <CardDescription>
                Descargá el archivo SQLite completo o restaurá una copia anterior.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SettingsBackup />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
