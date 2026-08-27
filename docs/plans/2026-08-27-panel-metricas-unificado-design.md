# Panel de métricas unificado — propuesta para validar

## Objetivo

Unir las rutas actuales **Panel** y **Métricas** en una sola superficie de análisis para operaciones. La vista debe conservar los indicadores útiles del panel, mantener las series temporales de métricas e incorporar las etiquetas de Transacciones como una dimensión real de filtro y análisis.

La experiencia está pensada para operadores y responsables de tesorería que necesitan responder rápido cuatro preguntas: cuántos envíos se realizaron, cuánto dinero se movió, por qué ruta de cambio y qué asesores o tipos de transacción componen el resultado.

## Dirección recomendada

- Mantener una sola entrada de navegación: **Panel de métricas**.
- Usar `/app/dashboard` como ruta canónica y redirigir `/app/metricas` para no romper enlaces guardados.
- Reemplazar los dos selectores de moneda por cinco opciones directas: **Todos**, **PEN → BRL**, **BRL → PEN**, **USD → BRL** y **BRL → USD**.
- Mostrar los filtros frecuentes siempre visibles: ruta, rango de fechas y agrupación. Estado, asesor y etiquetas quedan en **Más filtros** para evitar una barra saturada.
- Permitir cambiar la visualización entre **Barras**, **Dona** y **Línea**, manteniendo una segunda elección explícita de dimensión: **Evolución**, **Estado** o **Etiquetas**.
- Cargar el catálogo de etiquetas existente; no crear un catálogo paralelo dentro de Métricas.
- Mantener varios gráficos coordinados, como en la vista actual de Métricas: evolución de envíos, volumen enviado, envíos por asesor y monto enviado por asesor.
- Cuando se seleccione **Todos**, mostrar montos separados por PEN, BRL y USD. Nunca presentar una suma monetaria sin moneda.

## Comportamiento

1. El usuario elige una de las cinco rutas de cambio. El panel actualiza KPIs, series, monedas y distribuciones como un solo conjunto.
2. Puede acotar un rango variable y agrupar por día, semana, mes o año. Los controles se adaptan: fechas exactas para día, semanas ISO completas, meses completos o años completos. La interfaz normaliza cada selección a fechas ISO antes de consultar el backend.
3. Puede filtrar por una o varias etiquetas. Las etiquetas activas se muestran primero; las inactivas solo deben aparecer si están presentes en datos históricos.
4. El selector **Analizar por** cambia la forma de agrupar los datos:
   - **Evolución:** buckets de fecha.
   - **Estado:** conteos o volúmenes por estado de transacción.
   - **Etiquetas:** conteos o volúmenes por etiqueta.
5. El selector de gráfico cambia únicamente la representación. La dona agrega cada categoría al total del rango; barras y línea conservan la misma serie y escala.
6. La sección de asesores presenta dos lecturas complementarias:
   - **Envíos por asesor:** número total de transacciones gestionadas por cada persona.
   - **Monto enviado por asesor:** volumen de origen gestionado, con selector de moneda cuando se muestran todas las rutas.
7. Cada cambio visible se refleja en una fila de filtros activos. **Limpiar filtros** vuelve a Todos, últimos 30 días, semana, todos los estados, todos los asesores y ninguna etiqueta.
8. Cada gráfico incluye dos niveles de ayuda:
   - un botón informativo junto al título explica **qué muestra**, **cómo se calcula** y **cómo leerlo**;
   - al pasar el cursor o enfocar con teclado una barra, punto, segmento o fila, aparece el periodo/categoría y su valor exacto.

Las definiciones de cálculo no deben inventarse en el componente. Se mantienen como metadatos tipados compartidos para que el tooltip, las pruebas y la documentación usen la misma fórmula. En particular:

- **Envíos:** conteo de `envios_count` dentro de los filtros aplicados.
- **Volumen enviado:** suma de `envios_volume_origin` por moneda de origen y periodo.
- **Clientes nuevos:** valor `clientes_nuevos` devuelto por el backend, asociado a la etiqueta configurada para contar como cliente nuevo.
- **Envíos por asesor:** conteo agrupado por `agent_id`; los registros sin asesor forman **Sin asignar**.
- **Monto por asesor:** suma del volumen de origen agrupado por `agent_id` y moneda.
- **Estados:** conteo agrupado por clave `status`.
- **Etiquetas:** conteo por etiqueta; una transacción con varias etiquetas puede aportar a varias categorías, por lo que la suma de etiquetas puede superar el total de transacciones.

## Arquitectura propuesta

| Pieza                         | Responsabilidad                                            | Contrato principal                                                            |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `metrics_view.vue`            | Orquestar la vista unificada y permisos                    | Compone filtros, KPIs y secciones; no construye series                        |
| `MetricsFilterBar.vue`        | Editar filtros frecuentes, periodos adaptables y avanzados | `filters`, `agents`, `tags`, `loading`; emite `apply` y `clear`               |
| `CorridorSelector.vue`        | Exponer las cinco rutas sin combinaciones inválidas        | `modelValue`; emite `update:modelValue`                                       |
| `MetricsExplorer.vue`         | Coordinar dimensión, medida y tipo de gráfico              | `points`, `dimension`, `chartType`; emite cambios de vista                    |
| `MetricsChartGrid.vue`        | Organizar los varios gráficos coordinados                  | `timeSeries`, `advisorBreakdown`, `currency`; emite cambios de representación |
| `AdvisorPerformanceChart.vue` | Comparar cantidad y volumen por asesor                     | `advisors`, `measure`, `currency`, `chartType`                                |
| `MetricHelpTooltip.vue`       | Explicar significado, fórmula y lectura de cada métrica    | `title`, `description`, `calculation`, `readingHint`                          |
| `MetricChart.vue`             | Renderizar barra, dona o línea                             | `config`, `type`, `empty`, `loading`                                          |
| `MetricsBreakdown.vue`        | Mostrar distribución textual accesible                     | filas normalizadas con etiqueta, valor, porcentaje y color                    |
| `useMetricsExplorer.ts`       | Derivar series, totales y configuración                    | Estado fuente mínimo; todo lo derivado con `computed`                         |

El catálogo se obtiene mediante `useTagsStore`. La vista no debe llamar la API directamente: `metrics_view.vue` coordina stores/use cases y los componentes reciben datos por props y emiten eventos. No existe una variante separada para Marketing.

## Cambios de backend necesarios

El endpoint actual `GET /metrics/weekly` exige `origin_currency` y `destination_currency`, y solo devuelve series temporales. Para completar la propuesta necesita:

- aceptar una consulta agregada de todas las rutas, por ejemplo omitiendo monedas o usando `corridor=all`;
- aceptar múltiples etiquetas, preferiblemente `tag_ids=<id>&tag_ids=<id>`;
- devolver `breakdown_by_status` y `breakdown_by_tag`, o exponer un endpoint de distribución con el mismo conjunto de filtros;
- devolver `breakdown_by_agent` con identidad estable, nombre visible, cantidad de envíos y volumen de origen por moneda;
- mantener montos separados por moneda cuando la ruta sea **Todos**; no sumar PEN, BRL y USD en un único importe;
- devolver etiquetas históricas con `id`, `label` y `color` para que un cambio de nombre no rompa reportes previos.

### Qué depende del backend

| Funcionalidad                                       | ¿Requiere backend? | Situación actual                                                            |
| --------------------------------------------------- | -----------------: | --------------------------------------------------------------------------- |
| Unir Panel y Métricas en una sola ruta              |                 No | Es navegación y composición frontend                                        |
| Cambiar una serie existente entre barra y línea     |                 No | Los puntos ya llegan en `weeks`                                             |
| Mostrar tooltips de significado y cálculo           |                 No | Es presentación, usando definiciones validadas                              |
| Filtrar una ruta concreta                           |                 No | Ya existen `origin_currency` y `destination_currency`                       |
| Filtrar por un asesor concreto                      |                 No | Ya existe `agent_id`                                                        |
| Mostrar **Todos** los corredores                    |             **Sí** | Las dos monedas son obligatorias y la respuesta representa un solo corredor |
| Filtrar por una o varias etiquetas                  |             **Sí** | No existe `tag_ids` en el contrato actual                                   |
| Dona/distribución por estado con los mismos filtros |             **Sí** | No existe breakdown de estados filtrado                                     |
| Distribución por etiquetas                          |             **Sí** | No existe breakdown de etiquetas                                            |
| Envíos totales por cada asesor                      |             **Sí** | `agent_id` solo filtra uno; no devuelve comparación entre asesores          |
| Monto enviado por cada asesor                       |             **Sí** | No existe volumen agrupado por asesor y moneda                              |
| Totales separados por PEN, BRL y USD en **Todos**   |             **Sí** | La respuesta actual devuelve un único `envios_volume_origin`                |

### Opciones de contrato

1. **Nuevo `GET /metrics/overview` — recomendado.** Devuelve KPIs, series y breakdowns con un único conjunto de filtros. Mantiene `/metrics/weekly` durante la migración y evita convertir un endpoint “weekly” en una respuesta demasiado amplia.
2. **Ampliar `GET /metrics/weekly`.** Es el cambio inicial más pequeño y puede ser compatible si solo se agregan campos, pero el contrato se vuelve más complejo y su nombre deja de representar su alcance real.
3. **Separar series y breakdowns en varios endpoints.** Facilita caché y evolución independiente, pero multiplica peticiones y puede mostrar gráficos calculados con snapshots distintos.

La recomendación es crear `/metrics/overview`, reutilizando internamente las consultas agregadas existentes. El frontend cambiará de endpoint solo cuando el nuevo contrato esté probado; después se podrá deprecar `/metrics/weekly`.

Contrato frontend sugerido:

```ts
type Corridor = 'all' | 'PEN_BRL' | 'BRL_PEN' | 'USD_BRL' | 'BRL_USD'
type ChartType = 'bar' | 'donut' | 'line'
type AnalysisDimension = 'time' | 'status' | 'tag'

interface UnifiedMetricsFilters {
  corridor: Corridor
  dateFrom?: string | null
  dateTo?: string | null
  granularity: 'day' | 'week' | 'month' | 'year'
  status?: string | null
  agentId?: string | null
  tagIds: string[]
}

interface AdvisorMetricsBreakdown {
  agentId: string
  agentName: string
  enviosCount: number
  volumeOrigin: Partial<Record<'PEN' | 'BRL' | 'USD', number>>
}

interface MetricDefinition {
  title: string
  description: string
  calculation: string
  readingHint: string
}
```

Para una ruta específica, `volumeOrigin` normalmente tendrá una sola moneda. Para **Todos**, puede contener las tres y la UI permitirá compararlas por separado. Si una transacción no tiene asesor, el backend debe devolver una fila estable `unassigned` con la etiqueta **Sin asignar**.

## Permisos y migración

- `/app/dashboard` usa un wrapper compatible: monta el panel unificado cuando el usuario tiene `metrics.view` y conserva el dashboard anterior cuando solo tiene `dashboard.view`.
- `GET /metrics/overview` exige `metrics.view`; `dashboard.view` por sí solo no expone métricas financieras.
- Después de migrar roles en backend, conservar un único permiso canónico (recomendado: `metrics.view`) y retirar el otro en una fase posterior.
- El panel especial de Marketing permanece en `legacy_dashboard_view.vue` y se selecciona mediante el wrapper; no se mezcla con métricas financieras.
- La redirección de `/app/metricas` debe preservar query params de filtros compartibles.

## Implementación por etapas

1. **Definiciones funcionales compartidas:** confirmar qué estados cuentan como envío/volumen, zona horaria de los periodos, tratamiento de anuladas, cliente nuevo, transacciones con varias etiquetas y `Sin asignar`.
2. **Contrato backend:** documentar `GET /metrics/overview`, filtros, moneda, breakdowns, errores y compatibilidad de permisos.
3. **Backend agregado:** implementar consultas por periodo, estado, etiqueta y asesor sin descargar transacciones completas; añadir índices solo si el plan de ejecución lo requiere.
4. **Pruebas backend:** cubrir corredores individuales y Todos, monedas separadas, múltiples etiquetas, asesor, sin asignar, rango vacío y combinaciones de filtros.
5. **Adapter y dominio frontend:** introducir `Corridor`, `tagIds`, breakdowns tipados y normalización defensiva de la nueva respuesta.
6. **Núcleo de filtros:** conectar las cinco rutas, etiquetas, estado, asesor, fechas y query params; reutilizar `useTagsStore`.
7. **Explorador gráfico:** ampliar builders puros y `MetricChart` para barra, dona y línea; añadir tooltips de datos y `MetricHelpTooltip`.
8. **Métricas por asesor:** renderizar cantidad y volumen, tratamiento de `Sin asignar` y selector de moneda.
9. **Unificación visual y navegación:** mover KPIs útiles, dejar una sola entrada y mantener redirect/compatibilidad de permisos.
10. **QA conjunto:** comparar frontend contra fixtures del backend, probar escritorio/móvil/teclado/loading/error/empty, ejecutar suites backend y `npm run check`.

### Orden de entrega recomendado

- **Entrega 1 — Backend listo:** contrato, endpoint y pruebas con fixtures reales anonimizados.
- **Entrega 2 — Frontend integrado:** filtros, gráficos, tooltips y estados de interfaz usando el endpoint nuevo.
- **Entrega 3 — Migración:** una sola ruta, permisos consolidados, monitoreo de rendimiento y retiro posterior del endpoint anterior.

El frontend no debe calcular estas métricas descargando todas las transacciones: sería más lento, podría producir diferencias de permisos y duplicaría reglas financieras. Los conteos y sumas pertenecen al backend; el frontend transforma la respuesta únicamente para visualizarla.

## Criterios de aceptación

- Solo existe una entrada de navegación para Panel/Métricas.
- Las cinco rutas se entienden sin abrir selectores y nunca producen pares inválidos.
- Estado, asesor y múltiples etiquetas se combinan con fechas y ruta.
- Barras, dona y línea muestran el mismo universo filtrado y comunican su dimensión.
- El panel muestra varios gráficos simultáneamente: envíos y volumen por periodo, envíos por asesor y monto por asesor.
- Cada asesor muestra su cantidad total de envíos y su volumen de origen, incluyendo **Sin asignar** cuando corresponda.
- Todos los gráficos explican qué representan y cómo se calculan mediante ayuda visible por hover, foco y toque.
- Todos los elementos de datos exponen categoría y valor exacto con mouse y teclado; la ayuda no depende únicamente del color.
- **Todos** nunca mezcla importes de distintas monedas en un solo total.
- Los filtros sobreviven al refresco mediante query params o estado equivalente.
- La vista cubre carga, error, vacío y datos parciales sin bloquear toda la página.
- Pruebas de dominio/adapters/componentes y `npm run check` quedan verdes.

## Fuera de alcance

- Cambiar la paleta o la identidad visual del backoffice.
- Crear o editar etiquetas desde el panel de métricas.
- Convertir el panel financiero en el panel especial de Marketing.
- Añadir exportación hasta cerrar primero el contrato de filtros y monedas.
