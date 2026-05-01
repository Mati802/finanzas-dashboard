# Diseño — App de Finanzas Personales

**Fecha:** 2026-04-21
**Autor:** Juani (juanisaccani@gmail.com)
**Estado:** Aprobado para pasar a implementation plan

## 1. Contexto y objetivo

El usuario administra sus finanzas personales en Excel con tres planillas:

- Comparativa de ingresos USD (2025 vs 2026)
- Registro de gastos mensuales ARS (categorías fijas y variables)
- Resumen mensual/anual con conversión USD↔ARS

Este proyecto reemplaza ese flujo con una aplicación web local con estética oscura premium (referencia: FinSpace), mayor interactividad, cotizaciones en vivo y capacidades extra que el Excel no tiene (portfolio de inversiones, net worth, histórico de cotizaciones).

### Objetivos
1. Replicar funcionalidad del Excel con UX superior.
2. Agregar tracking de inversiones, deudas y patrimonio neto.
3. Cotización del dólar automática y configurable (múltiples tipos).
4. Ticker superior customizable (crypto, acciones, FX).
5. Importar planillas existentes sin pérdida de datos.

### No-objetivos (fuera de alcance)
- Multi-usuario / autenticación.
- Acceso remoto / móvil nativo.
- Integración bancaria (scraping, Open Banking).
- Presupuestos con alertas (posible extensión futura).
- Metas de ahorro con tracking (posible extensión futura).

## 2. Arquitectura

### Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| Styling | Tailwind CSS v4 |
| Componentes UI | shadcn/ui + 21st.dev |
| Iconos | Lucide React |
| Charts | Recharts |
| Base de datos | SQLite (vía Prisma ORM) |
| Fetch/cache cliente | TanStack Query |
| Parser Excel | `xlsx` (SheetJS) |

### Ejecución

- `npm run dev` levanta Next.js en `localhost:3000`.
- Base de datos: archivo único `finanzas.db` en la raíz del proyecto (gitignored).
- Background job de refresh de cotizaciones cada 2–5 minutos mientras la app está abierta (ver §5).

### Estructura de carpetas

```
finanzas/
├── app/
│   ├── page.tsx                # Dashboard
│   ├── transacciones/page.tsx
│   ├── ingresos/page.tsx
│   ├── gastos/page.tsx
│   ├── inversiones/page.tsx
│   ├── patrimonio/page.tsx
│   ├── reportes/page.tsx
│   ├── ajustes/page.tsx
│   └── api/
│       ├── rates/route.ts
│       ├── rates/history/route.ts
│       ├── rates/refresh/route.ts
│       ├── market/[ticker]/route.ts
│       └── import/excel/route.ts
├── components/
│   ├── layout/Sidebar.tsx
│   ├── layout/Ticker.tsx
│   ├── dashboard/KPICard.tsx
│   ├── dashboard/AreaChart.tsx
│   ├── dashboard/ComparisonChart.tsx
│   ├── dashboard/CashflowChart.tsx
│   ├── dashboard/CategoryBreakdown.tsx
│   └── common/*
├── lib/
│   ├── db.ts                   # Cliente Prisma
│   ├── rates.ts                # Fetcher de cotizaciones (dolarapi, coingecko, yahoo, frankfurter)
│   ├── import-excel.ts         # Parser de planillas
│   └── format.ts               # Formateo ARS/USD
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                 # Categorías default
└── finanzas.db                 # SQLite local (gitignored)
```

## 3. Modelo de datos

Todas las tablas están en SQLite, gestionadas vía Prisma.

### Transaction
Ingresos y gastos unificados.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int PK | |
| `date` | date | Fecha del movimiento |
| `type` | enum | `income` \| `expense` |
| `amount` | decimal(14,2) | Monto |
| `currency` | enum | `USD` \| `ARS` |
| `category_id` | FK → Category | |
| `note` | text nullable | Descripción libre |
| `created_at` | datetime | |

### Category

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int PK | |
| `name` | text | ej: "Movistar", "Claude" |
| `kind` | enum | `fixed` \| `variable` \| `income` |
| `icon` | text | Nombre de icono Lucide (ej: `zap`) |
| `color` | text | Hex (ej: `#8b5cf6`) |
| `is_recurring` | boolean | Si el flujo de recurrentes la sugiere cada mes |

### Asset
Activos del portfolio.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int PK | |
| `name` | text | ej: "Dólares caja", "AAPL", "BTC" |
| `type` | enum | `cash_usd` \| `cash_ars` \| `stock` \| `crypto` \| `property` \| `other` |
| `quantity` | decimal(18,8) | |
| `ticker` | text nullable | Si aplica (ej: "AAPL", "bitcoin") |
| `price_source` | enum nullable | `manual` \| `yahoo` \| `coingecko` |
| `manual_value` | decimal(14,2) nullable | Usado si `price_source = manual` |
| `currency` | enum | `USD` \| `ARS` |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### Liability
Deudas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int PK | |
| `name` | text | ej: "Tarjeta Visa" |
| `amount` | decimal(14,2) | |
| `currency` | enum | `USD` \| `ARS` |
| `due_date` | date nullable | |
| `note` | text nullable | |

### ExchangeRate
Cache de cotizaciones USD/ARS (una fila nueva por fetch, conserva histórico para gráficos).

| Campo | Tipo |
|---|---|
| `id` | int PK |
| `type` | enum (`oficial`, `blue`, `mep`, `ccl`, `usdt`) |
| `buy_price` | decimal(10,2) |
| `sell_price` | decimal(10,2) |
| `fetched_at` | datetime |

### MarketPrice
Cache de precios de crypto, acciones, índices.

| Campo | Tipo |
|---|---|
| `id` | int PK |
| `ticker` | text (ej: `BTC-USD`, `AAPL`, `^GSPC`) |
| `price` | decimal(18,8) |
| `change_pct_24h` | decimal(6,2) |
| `fetched_at` | datetime |

### Snapshot
Snapshot diario del patrimonio para poder graficar su evolución histórica (ya que `Asset` solo tiene el estado actual, no el histórico).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int PK | |
| `date` | date UNIQUE | Un snapshot por día |
| `assets_usd` | decimal(14,2) | Suma de todos los activos en USD |
| `liabilities_usd` | decimal(14,2) | Suma de deudas en USD |
| `net_worth_usd` | decimal(14,2) | Diferencia |
| `exchange_rate_used` | decimal(10,2) | Cotización del día (para auditar conversiones) |
| `created_at` | datetime | |

El snapshot se genera automáticamente la primera vez que el usuario abre la app cada día (comparando `MAX(date)` del snapshot más reciente con la fecha actual).

### TickerItem
Items configurables del ticker superior.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int PK | |
| `display_label` | text | ej: "BTC/USD", "AAPL", "EUR/ARS" |
| `source_type` | enum | `fx_ars` \| `fx_usd` \| `crypto` \| `stock` \| `index` |
| `source_key` | text | Key para el provider (ej: `bitcoin` para CoinGecko) |
| `order_index` | int | Para drag-and-drop reorder |
| `is_visible` | boolean | |

### Setting
Preferencias del usuario (key-value).

| Campo | Tipo |
|---|---|
| `key` | text PK |
| `value` | text |

Keys conocidas:
- `default_rate_type`: `blue` \| `oficial` \| `mep` \| `ccl` \| `usdt`
- `rate_override`: cotización manual si el usuario no quiere usar la API

## 4. Pantallas

### 4.1 `/` — Dashboard
Home. Contiene:
- **Ticker superior** configurable (ver §4.8).
- **4 KPI cards**: Patrimonio, Ingresos del mes, Gastos del mes, Balance — cada uno con icono, valor, delta vs mes anterior y sparkline.
- **Gráfico área "Evolución del Patrimonio"** (valor total USD en el tiempo, curva suave con gradiente).
- **Donut "Asignación de Activos"** (USD cash / Inversiones / ARS líquido con leyenda y %).
- **Gráfico área "Ingresos 2025 vs 2026"** (dos series curvas superpuestas con gradientes, tooltip al hover mostrando valor de cada año para el mes).
- **Gráfico barras "Flujo de caja mensual"** (ingresos vs gastos lado a lado por mes, tooltip al hover con valores y balance).
- **Top categorías de gasto** (barras horizontales con monto y %).

Todos los gráficos con:
- Ejes Y con labels de escala
- Ejes X con labels de tiempo
- Grid sutil de referencia
- Tooltip al hover: fecha/mes + valor por serie

### 4.2 `/transacciones` — Historial unificado
- Tabla con todas las transacciones (ingresos y gastos juntos).
- Filtros: rango de fecha, tipo, categoría, moneda, búsqueda por nota.
- Cada fila editable/eliminable.
- Botón "+ Nueva transacción" arriba.

### 4.3 `/ingresos`
- Tabla mensual (filas = meses, columnas = 2025, 2026, Diferencia) replicando la estructura del Excel.
- Gráfico grande de comparativa año vs año (área curva con gradiente, al estilo del dashboard).
- Totales del año.
- Botón "+ Ingreso rápido".

### 4.4 `/gastos`
- Selector de mes arriba.
- Sección "**Recurrentes pendientes**": lista categorías marcadas `is_recurring` que aún no tienen transacción en el mes seleccionado. Cada una muestra el último monto y un botón `[Agregar]` que abre un mini-modal pre-rellenado pero editable (el usuario puede ajustar el monto antes de confirmar).
- Tabla de gastos del mes, separada visualmente en "Fijos" y "Variables".
- Gráfico de torta con distribución porcentual del mes.
- Total del mes + total anual acumulado.

### 4.5 `/inversiones`
- Lista/tabla de activos (campos Asset): nombre, cantidad, precio actual (en vivo), valor USD, cambio 24h, % del portfolio.
- Botón "+ Agregar activo" abre modal: el usuario elige tipo (crypto/stock/manual); si es crypto o stock ingresa un ticker y la app lo resuelve contra CoinGecko o Yahoo; si es manual pone nombre y valor.
- Gráfico histórico del valor total del portfolio.

### 4.6 `/patrimonio`
- KPI grande: Patrimonio Neto = Assets − Liabilities.
- Gráfico histórico de patrimonio mes a mes.
- Desglose: Cash líquido (USD+ARS) + Inversiones + Propiedades − Deudas.
- Tabla CRUD de `Liability`.

### 4.7 `/reportes`
- Generador: rango de fechas + qué incluir (ingresos / gastos / patrimonio / categorías).
- Estadísticas calculadas: promedio ingresos y gastos, categoría top, ratio ahorro.
- Exportar a PDF o XLSX.

### 4.8 `/ajustes`
Secciones:
1. **Cotización** — selector de `default_rate_type` + opción de override manual.
2. **Configurar Ticker** — lista draggable de `TickerItem` con reorder, eliminar, y botón "+ Agregar" que abre modal para elegir tipo (Crypto / Acción / Índice / FX vs ARS / FX vs USD) y buscar símbolo.
3. **Categorías** — CRUD completo de `Category` (crear, editar nombre/icono/color, marcar `is_recurring`, eliminar).
4. **Importar desde Excel** — ver §6.
5. **Backup / Restore** — descargar `finanzas.db`; subir un `.db` previo para restaurar.

## 5. Cotizaciones y precios en vivo

### Fuentes externas

| Dato | API | Auth | Refresh |
|---|---|---|---|
| Cotizaciones USD/ARS (Oficial, Blue, MEP, CCL, USDT) | `https://dolarapi.com/v1/dolares` | Ninguna | 5 min |
| Crypto (BTC, ADA, etc.) | `https://api.coingecko.com/api/v3/simple/price` | Ninguna (30 req/min) | 2 min |
| Acciones e índices (SP500, AAPL, etc.) | `yahoo-finance2` npm | Ninguna | 5 min |
| FX pairs (EUR/USD, EUR/ARS, BRL/ARS) | `https://api.frankfurter.app` | Ninguna | 5 min |

### Estrategia de cache

1. Al abrir la app, si `fetched_at` de la última fila tiene más que la ventana de refresh, se hace request y se inserta fila nueva en `ExchangeRate` / `MarketPrice`.
2. Mientras la app está abierta, un `setInterval` dispara refresh cada 2–5 min según el tipo.
3. Si la API falla, la UI mantiene el último valor conocido y muestra un indicador gris "desactualizado" con tooltip con la hora del último fetch exitoso.
4. Offline: la app sigue 100% usable con datos locales; las cotizaciones muestran el último cache.

### Endpoints internos

```
GET  /api/rates              → cotizaciones actuales (cache + refresh si expiró)
GET  /api/rates/history      → histórico (para gráficos)
GET  /api/market/:ticker     → precio actual de un ticker
POST /api/rates/refresh      → force refresh
```

Los endpoints agregan una capa de abstracción sobre los providers externos para aislar cambios y permitir cache server-side.

La importación de Excel **no** usa un endpoint API: el parser corre 100% del lado cliente (ver §6).

### Ticker superior

Componente que lee `TickerItem WHERE is_visible = true ORDER BY order_index`. Para cada item, consulta la tabla correspondiente (`ExchangeRate` o `MarketPrice`) según `source_type`. Default al primer arranque:

`BTC/USD · ADA/USD · SP500 · OFICIAL · BLUE · USDT`

## 6. Importación desde Excel

### Qué se importa

| Hoja | Mapea a |
|---|---|
| Comparativa Ingresos | `Transaction` (type=income, 12×2 filas, una por mes×año con monto > 0) |
| Registro Gastos ARS | `Transaction` (type=expense, una fila por celda con monto > 0) + `Category` con defaults |
| Resumen | No se importa (es derivable) |

### Flujo UX

1. En `/ajustes`, botón "Importar desde Excel".
2. Usuario sube `.xlsx`. El parser (`xlsx` npm) corre del lado cliente en el browser: lee el archivo y produce un objeto JS con la estructura detectada. El archivo crudo nunca se envía a ningún lado.
3. Preview con resumen de lo detectado (cantidad de ingresos, cantidad de categorías, cantidad de gastos).
4. Confirmación → el cliente llama a un Server Action de Next.js pasando la data ya parseada; el Server Action ejecuta la inserción atómica vía Prisma (`$transaction`: todo o nada). Como Next.js corre en `localhost`, esto sigue siendo local.
5. Si ya existen datos del mismo mes, se pregunta: reemplazar / omitir / duplicar.

### Mapeo

**Ingresos:**
```
Row "Febrero", Col "2025" → Transaction {
  type: 'income', date: '2025-02-01', amount: 550, currency: 'USD'
}
```

**Gastos:**
```
Row "Movistar" (fixed), Col "Enero" → Transaction {
  type: 'expense', date: '2026-01-15', amount: 42150,
  currency: 'ARS', category_id: <Movistar>
}
```

Para gastos, el día se setea en 15 como default (luego editable). Montos = 0 se omiten.

### Categorías default

Precargadas con icono y color:

| Nombre | Kind | Icono | Color |
|---|---|---|---|
| Movistar | fixed | `signal` | `#8b5cf6` |
| Claude | fixed | `brain-circuit` | `#a78bfa` |
| Adobe | fixed | `palette` | `#fb923c` |
| Google | fixed | `chrome` | `#4ade80` |
| Apple | fixed | `apple` | `#e4e4e7` |
| Avatar IA | variable | `bot` | `#a78bfa` |
| Perplexity | variable | `search` | `#4ade80` |
| Higgsfield | variable | `video` | `#fb923c` |
| Pletor | variable | `box` | `#64748b` |
| CSS Buy | variable | `shopping-bag` | `#fb923c` |
| Uber | variable | `car` | `#f87171` |
| Comidas fuera | variable | `utensils` | `#fb923c` |
| Juegos | variable | `gamepad-2` | `#a78bfa` |

Todas editables después en `/ajustes`.

### Edge cases

- Celdas vacías o = 0: omitidas.
- Formato raro (`ARS $42.150,00`): el parser limpia símbolos y separadores.
- Año no detectable: la UI pregunta antes de importar.
- Nombres de hoja distintos: el parser busca por estructura (columna de meses, categorías conocidas), no por nombre de hoja.

## 7. Diseño visual

### Paleta (dark theme)

| Rol | Color |
|---|---|
| Fondo principal | `#08080c` |
| Fondo card | `#0d0d14` |
| Border sutil | `#1a1a22` / `#17171f` |
| Texto primario | `#e4e4e7` / `#fff` |
| Texto secundario | `#a1a1aa` |
| Texto muted | `#71717a` |
| Acento primario | `#8b5cf6` (purple) / `#a78bfa` |
| Success / positive | `#4ade80` |
| Danger / negative | `#f87171` |
| Warning / neutral | `#fb923c` |

### Tipografía
Inter (sans-serif). Pesos 400, 500, 600, 700.

### Componentes clave
- **Sidebar** izquierdo 180px, iconos Lucide, item activo con fondo `#17171f` e icono en acento.
- **Ticker** superior: barra horizontal con label/valor/delta color-coded por item.
- **KPI card** con glow sutil por categoría (purple/green/red/orange gradient top → transparent), sparkline absolute en esquina inferior derecha.
- **Charts**: áreas con gradient fill, curvas suaves (bezier cubic, no polylines rectas), grid horizontal sutil, ejes con labels, tooltip en hover mostrando fecha y valor de cada serie.
- **Donut** con gaps entre segmentos y leyenda lateral con % a la derecha.

## 8. Consideraciones técnicas

### Manejo de dinero
Todos los montos se guardan como `decimal` en SQLite (no `float`) para evitar errores de precisión. Prisma soporta el tipo.

### Conversión USD ↔ ARS
En consultas que necesitan mezclar monedas (ej: KPI de Balance), la conversión se hace en query-time aplicando la cotización actual según `default_rate_type`. Para gráficos históricos, se usa la cotización de la fecha del punto (requiere lookup en `ExchangeRate` por `fetched_at` más cercano).

### Performance
Con el volumen esperado (miles de transacciones en años de uso), SQLite + índices en `date` y `category_id` son más que suficientes. Paginar solo si la tabla de transacciones crece por encima de ~5000 filas.

### Backup
La estrategia de backup es simple: el botón en `/ajustes/backup` descarga el archivo `finanzas.db` completo. Restore lo sobrescribe.

### Testing
- Unit tests: `lib/rates.ts` (fetchers con mocks), `lib/import-excel.ts` (parser con fixtures).
- Integration tests: API routes con DB en memoria.
- E2E (opcional): Playwright para flujos principales (crear transacción, importar Excel, cambiar cotización).

## 9. Fuera del alcance (posibles extensiones)

- Presupuestos por categoría con alertas.
- Metas de ahorro con progreso visual.
- Sync a la nube (Dropbox, iCloud) del archivo SQLite.
- Versión PWA para móvil.
- Reporte de impuestos (ganancias, bienes personales).
- Integración con brokers / exchanges vía API para sync automático de positions.
