# Plan: llevar los dashboards de Excel al panel de métricas

Fecha: 2026-10-02. Estado: **los 16 gráficos implementados** (ver §5). Las decisiones de negocio del §2 se tomaron por defecto y pueden ajustarse.

## 5. Estado de implementación (2026-10-02)

Hecho — sección nueva **Gerencia** en el menú, separada del Panel operativo, con permiso propio `management.view` (admin y contabilidad por defecto; migración `081`):

| Pestaña | Ruta | Gráficos | Estado |
|---|---|---|---|
| Envíos | `/app/gerencia/envios` | A1 envíos/mes, A2 % por moneda, A3 envíos/mes/razón social | ✅ |
| Clientes | `/app/gerencia/clientes` | B1 activos, B2 variación %, B3 nuevos, B4 TRC, B5 top clientes del mes | ✅ |
| Montos | `/app/gerencia/montos` | C1 por moneda, C2 total en soles, C3 % por moneda en soles, C4 variación mensual | ✅ (C2–C4 requieren tasas registradas) |
| Resultados | `/app/gerencia/resultados` | D1 ingreso bruto, D2 costos, D3 ganancia neta, D4 costos por categoría | ✅ (requieren tasas y egresos registrados) |

- API: `GET /metrics/management?year&currency&company&corridor&status&top_month&top_limit` (`app/modules/metrics/infrastructure/management_repository.py`). Devuelve los 12 meses + diciembre del año anterior (base para la variación de enero), razones sociales vistas, top clientes, `fx_missing` (meses sin tasa) y `expenses_by_category`.
- API módulo nuevo `app/modules/finance/` (migración `082`, esquema `finance`): `GET/PUT /finance/fx-rates`, `GET /finance/expense-categories`, `GET/POST/PUT/DELETE /finance/expenses`. Permisos `fx_rates.view/update` y `expenses.view/create/update/delete` (contabilidad por defecto). Las 11 categorías del Excel vienen sembradas.
- Front: módulo `src/modules/gerencia/` (dominio con `calculations.ts` testeado contra los números del Excel, adapter, store Pinia, 4 vistas y builders ApexCharts propios) y módulo `src/modules/egresos/` (`/app/egresos`, menú "Egresos": tabla de gastos con alta/edición/borrado y pestaña "Tasas a soles" con una grilla 12 meses × BRL/USD).
- Filtros (año, moneda, razón social) viven en la URL (`?year=&currency=&company=&month=`).
- Cuando falta la tasa de un mes con envíos, Montos y Resultados muestran un aviso con enlace a `/app/egresos?tab=tasas` y omiten ese mes en los gráficos en soles (no inventan ceros).

Decisiones tomadas por defecto (cambiables):
1. Mes por `created_at`. Se verificó en la BD que `created_at` se guarda como hora de Lima (sesión en UTC + `now() AT TIME ZONE 'America/Lima'`), así que `date_trunc('month', created_at)` ya da meses de Lima y **no** se aplica conversión extra. Si se corrige el `server_default` (hallazgo M3 del informe), hay que cambiar esta consulta a la vez.
2. Clientes nuevos = primera transacción histórica del cliente (como el Excel), no por etiqueta.
3. Razón social = `Bank.company` de la cuenta Brasper destino, con fallback a `Transaction.company_name`. **Ojo:** el catálogo tiene variantes ("BRASPER 21", "BRASPER 21 S.A.C", "BRASPER 21 SAC", "Brasper 21 Corretora…"); el Excel las agrupa en 3. Para que A3 muestre 3 barras hay que unificar el campo Empresa en *Cuentas Brasper* (dato, no código).
4. Se cuentan todas las transacciones no eliminadas (sin filtrar estado), igual que el Excel.
5. Conversión a soles: tabla `finance.fx_month_rates` que gerencia carga a mano (año, mes, moneda → soles). PEN = 1.
6. Ingreso bruto = `Transaction.commission_result` (comisión efectivamente cobrada, en moneda de origen) convertida a soles con la tasa del mes. Si negocio prefiere `accounting_commision` o comisión + spread, es un cambio de una línea en `management_repository.py`.
7. Egresos siempre en soles, una fila por gasto, sin importación Excel (puede añadirse después).

Pendiente operativo: registrar las tasas de los meses con envíos (jul–oct 2026) y cargar los egresos; sin eso, Montos (C2–C4) y Resultados quedan en blanco con el aviso correspondiente.

Origen: 4 hojas del Excel de gerencia ("Dashboard cantidad envíos", "control clientes",
"Montos enviados", "Ingresos y Egresos"), 16 gráficos en total.

## 0. Lo que ya existe y se reutiliza

| Pieza | Dónde | Sirve para |
|---|---|---|
| `GET /metrics/overview` (corredor, rango, granularidad, estado, asesor, tags) | `api/app/modules/metrics/` | base de filtros; ya agrupa por `date_trunc(month, created_at)` y separa por moneda de origen |
| `MetricChart.vue` + `use_metric_chart_options.ts` (ApexCharts: bar/line/donut) | `src/modules/metrics/presentation/` | contenedor de gráfico con tipo conmutable, tooltip de ayuda, loading/empty |
| `MetricsFilterBar.vue`, store Pinia con `requestId` anti-respuestas obsoletas | ídem | filtros compartidos |
| `clientes_nuevos` por etiquetas `counts_as_new_client` | back `new_clients_statement` | gráfico 6 |
| `Transaction.company_name` / `social_reason_bank_id → Bank.company` | `transactions/domain/models.py:85-92` | gráfico 3 (razón social) |
| `Transaction.commission_result`, `tax_amount`, `accounting_commision`, `accounting_tax_final`, `billing_date` | ídem `:106-118,132` | gráficos 13 y 15 (ingresos) |

Lo que **no existe**: costos/egresos (gráficos 14, 15, 16). No hay ninguna tabla ni módulo
de gastos en el API. Hay que crearlo.

## 1. Inventario de gráficos y cómo se calcula cada uno

Notación: M = mes; moneda de origen = `TaxRate.coin_a` de la transacción (SOLES=PEN, REALES=BRL, DOLARES=USD).

### Hoja A — Cantidad de envíos
| # | Gráfico (Excel) | Tipo | Dato | Filtros en Excel | Fuente / cálculo |
|---|---|---|---|---|---|
| A1 | Número de envíos por mes | barras | `count(tx)` por M | Mes, moneda | ya existe en `series[].envios_count` con `granularity=month` |
| A2 | % de envíos por moneda por mes | barras apiladas 100 % | `count` por M × moneda ÷ total M | Mes | nuevo: `series[].envios_count_by_currency: {PEN,BRL,USD}` (el back ya hace `group_by(period, coin_a)`, solo falta exponerlo) |
| A3 | N° envíos / mes / razón social | barras agrupadas | `count` por M × empresa | Cuenta (BRASPER, Brasper Brasil, INGENITECH) | nuevo: `breakdown_by_company_monthly`. Fuente: `Bank.company` vía `social_reason_bank_id` (fallback `company_name`) |

### Hoja B — Control de clientes
| # | Gráfico | Tipo | Dato | Fuente / cálculo |
|---|---|---|---|---|
| B1 | Clientes activos por mes | barras | `count(distinct user_id)` por M | nuevo: `active_clients` |
| B2 | % variación de clientes activos | línea | `(B1_M − B1_{M−1}) / B1_{M−1}` | derivado en front, pero requiere traer **M−1 del rango** (ver nota) |
| B3 | Clientes nuevos por mes | barras | ya existe (`clientes_nuevos`, por etiqueta) | reutilizar. Decidir si se mantiene la definición por etiqueta o "primera transacción del cliente" (la que usa `/metrics/weekly`) |
| B4 | % tasa de retención (TRC) | línea | `(activos_M − nuevos_M) / activos_{M−1}` — verificado con el Excel: Jul (588−66)/536 = 97 %, Jun (536−84)/562 = 80 % | derivado en front a partir de B1 y B3 |
| B5 | Clientes top por N° de envíos (mes seleccionado) | barras | top N `count(tx)` por `user_id` | Mes, moneda | nuevo: `top_clients` (param `month`, `limit=15`) |

Nota B2/B4: para calcular la variación del primer mes del rango se necesita el mes anterior. El back devolverá la serie con un punto extra previo (`series_prev`) o el front pedirá `date_from − 1 mes` y lo descartará al pintar. Recomiendo lo primero.

### Hoja C — Montos enviados
| # | Gráfico | Tipo | Dato | Fuente / cálculo |
|---|---|---|---|---|
| C1 | Montos enviados por mes y moneda (en miles) | líneas (3 series) | `sum(origin_amount)` por M × moneda | ya existe: `series[].volume_origin` |
| C2 | Monto total por mes expresado en soles | barras | Σ moneda convertida a PEN | nuevo: `volume_origin_pen`. **Requiere decidir la tasa de conversión (§2.1)** |
| C3 | % representación por moneda respecto al total en soles | apiladas 100 % | `C2 por moneda ÷ C2 total` | derivado de C2 (devolver `volume_pen_by_currency`) |
| C4 | % variación mensual del monto total en soles | barras ± | `(C2_M − C2_{M−1}) / C2_{M−1}` | derivado en front (mismo punto previo que B2) |

### Hoja D — Ingresos y egresos
| # | Gráfico | Tipo | Dato | Fuente / cálculo |
|---|---|---|---|---|
| D1 | Ingreso bruto / ventas por mes (soles) | barras | ingreso de la empresa por M | nuevo: `revenue_pen`. **Requiere definir "ingreso" (§2.2)** |
| D2 | Costos por mes (soles) | barras | `sum(expense.amount_pen)` por M | nuevo módulo **Egresos** |
| D3 | Ganancia neta por mes | barras ± | `D1 − D2` | derivado |
| D4 | Costos por categoría (mes seleccionado) | barras % | `sum por categoría ÷ total mes` | nuevo módulo Egresos. Categorías vistas: Planilla, Otros, Viáticos, Legal, Capacitación, Publicidad, Salud, Alimento, Servicios, Ropa, Impuestos |

## 2. Decisiones pendientes (necesito respuesta antes de desarrollar)

1. **Conversión a soles (C2, C3, C4, D1).** ¿Qué tasa se usa?
   - (a) la tasa de la propia transacción (`TaxRate.tax`): sirve para PEN↔BRL, pero USD→BRL no pasa por soles;
   - (b) una tasa mensual fija que gerencia carga a mano (tabla `fx_month_rates`: mes, moneda, tasa a PEN) — es lo que hace el Excel implícitamente;
   - (c) tasa de un proveedor externo. **Recomiendo (b)**: reproducible, auditable y lo que hoy ya hacen.
2. **Definición de "ingreso bruto" (D1).** Opciones: `commission_result` (comisión cobrada), `accounting_commision` (comisión contable), o comisión + spread de tasa. Hay que confirmar con contabilidad qué columna del Excel alimenta ese gráfico.
3. **Fecha de referencia.** ¿Mes por `created_at` (operativo) o por `billing_date` (facturación)? Para A/B/C propongo `created_at`; para D (ingresos) propongo `billing_date` con fallback a `created_at`.
4. **Zona horaria.** Las métricas actuales cortan el día en UTC y hay un bug con `created_at` desplazado ~5 h (`app/db/configuration_hour.py:13`, ver informe de revisión M3). Los cortes mensuales deben hacerse en `America/Lima`. Hay que arreglar eso **antes**, o los meses no cuadrarán con el Excel.
5. **Razón social (A3).** ¿Usamos `Bank.company` del `social_reason_bank_id` (catálogo) o `Transaction.company_name` (texto libre)? Propongo el catálogo con fallback al texto.
6. **Clientes nuevos (B3).** ¿Etiqueta `counts_as_new_client` (como hoy) o "primera transacción histórica del cliente"? El Excel parece lo segundo.
7. **Egresos.** ¿Carga manual uno a uno + importación Excel? ¿Quién puede registrarlos (rol contabilidad)? ¿Moneda única PEN o multi-moneda con conversión?
8. **Estados.** ¿Los gráficos cuentan todas las transacciones o solo `verified/completed`? El `/overview` acepta `status`; propongo que el dashboard gerencial excluya `failed` por defecto.

## 3. Fases de desarrollo

### Fase 0 — Preparación (API)
- Arreglar `created_at` / zona horaria (decisión 4) y migrar datos existentes.
- Añadir índice en `transactions(created_at, deleted)` si no existe (las nuevas consultas agregan por mes sobre todo el año).

### Fase 1 — API: endpoint de dashboard gerencial
Nuevo `GET /metrics/dashboard` (permiso `metrics.view`), parámetros: `year`, `date_from/date_to` opcionales, `corridor`, `status`, `month` (para B5 y D4), `top_limit`.

Respuesta (snake_case, consistente con `MetricsOverviewDTO`):
```
range, series_prev (1 punto, mes anterior al rango),
series: [{ period_start,
           envios_count, envios_count_by_currency,
           active_clients, new_clients,
           volume_origin, volume_pen_by_currency, volume_pen_total,
           revenue_pen, expenses_pen }],
breakdown_by_company: [{ company, months: [{period_start, count}] }],
top_clients: [{ user_id, name, envios_count }],
expenses_by_category: [{ category, amount_pen, share }]
```
- Repositorio: `app/modules/metrics/infrastructure/repository.py` → nuevo método `dashboard_metrics`. Reutilizar `_overview_scope_conditions`, `_align/_advance`.
- Caso de uso + DTOs en `application/`, ruta en `adapters/router/metrics_routes.py`.
- Tests con sqlite en memoria como `test_metrics_multiple_new_client_tags.py` (instalar `aiosqlite` en el venv).

### Fase 2 — API: módulo Egresos y tasas mensuales
- Tablas `accounting.expenses` (id, date, category_id, description, amount, currency, amount_pen, voucher, created_by, soft-delete) y `accounting.expense_categories` (seed con las 11 categorías del Excel).
- Tabla `accounting.fx_month_rates` (year, month, currency, rate_to_pen) si se elige la opción (b).
- Permisos nuevos: `expenses.view/create/update/delete`, `fx_rates.view/update`; defaults para admin y accounting; migración de `role_permissions`.
- Rutas CRUD + `POST /expenses/import` (Excel, misma plantilla de columnas que usa gerencia). Límite de filas e import atómico (no repetir el problema de `/transactions/import`).

### Fase 3 — Backoffice
- `metrics_view.vue` ya está cerca de su límite de tamaño; crear sub-vistas por pestaña en `src/modules/metrics/presentation/bodies/`: `dashboard_envios_view.vue`, `dashboard_clientes_view.vue`, `dashboard_montos_view.vue`, `dashboard_resultados_view.vue`, con un `DashboardTabs` y un store `use_dashboard_store_controller.ts` (filtros: año, mes, moneda, razón social).
- Nuevos builders en `use_metric_chart_options.ts`: `buildStacked100Chart`, `buildGroupedBarChart`, `buildMultiLineChart`, `buildSignedBarChart` (negativos en rojo, como D3/C4), `buildPercentLineChart`. Ampliar `MetricChartType` solo si hace falta (`stacked`).
- Cálculos derivados (variaciones %, TRC, ganancia) en `domain/dashboard_calculations.ts` con tests unitarios (usar los números del Excel como fixtures: p. ej. TRC Jul = 97 %).
- Pantalla "Egresos" en `src/modules/contabilidad/` (tabla, alta/edición, import Excel) y "Tasas mensuales".
- Formato: `S/ 1,873,659` (es-PE), `R$`, `$`; etiquetas de mes en español.

### Fase 4 — Cierre
- Actualizar `api_routes.json` y el test de contrato; `FEATURE_MAP.md` y `PRODUCT.md`.
- Validar contra el Excel real de un mes cerrado (los 16 gráficos deben dar el mismo número).

## 4. Estimación orientativa
| Fase | Esfuerzo |
|---|---|
| 0 | 1 día (incluye migración de datos) |
| 1 | 2–3 días |
| 2 | 2–3 días |
| 3 | 4–5 días |
| 4 | 1 día |

Los gráficos A1, A2, B3, C1 pueden salir en el primer día de la fase 3 porque sus datos ya están en `/overview`.
