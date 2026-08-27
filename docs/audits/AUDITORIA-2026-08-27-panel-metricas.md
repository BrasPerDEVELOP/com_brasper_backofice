# Auditoría — Panel de métricas unificado

Fecha: 2026-08-27  
Alcance: entrega del panel operativo unificado; revisión read-only del resto del proyecto.

## Resumen ejecutivo

- La entrega respeta el flujo `view → store → use case → repository → adapter → apiClient`.
- `/app/dashboard` es la ruta canónica y acepta `dashboard.view` o `metrics.view`; `/app/metricas` conserva compatibilidad mediante redirección con query.
- Todos los roles autorizados comparten el mismo panel; se retiró la variante editorial de Marketing por falta de uso.
- Los importes se conservan separados por PEN, BRL y USD; no se suman monedas incompatibles.
- `npm run check`, `npm run build` y las 340 pruebas frontend finalizaron correctamente; el backend agregó 3 pruebas y su suite completa terminó con 258 pruebas correctas.

## Hallazgos por severidad

| Severidad | Archivo:línea                                                            | Hallazgo                                                                                                      | Acción sugerida                                                                                 |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| CRITICAL  | `src/modules/transacciones/presentation/bodies/transacciones_view.vue:1` | Archivo preexistente de 6449 líneas; supera ampliamente el umbral de 3000. No fue modificado en esta entrega. | Ejecutar la Fase C de split ya planificada antes de añadir más comportamiento.                  |
| LOW       | `src/interface/config/env.ts:126`                                        | Se mantienen los endpoints semanal y overview durante la transición.                                          | Retirar `metricsWeeklyPath` solo cuando ningún consumidor externo dependa de `/metrics/weekly`. |
| LOW       | `src/interface/router/index.ts:60`                                       | La ruta histórica `/app/metricas` permanece como alias.                                                       | Mantener al menos durante una versión y medir accesos antes de eliminarla.                      |

No se encontraron hallazgos HIGH o MEDIUM nuevos dentro del módulo de métricas.

## Verificación de arquitectura y seguridad

- Capas completas: modelos en `src/modules/metrics/domain/models/index.ts`, casos de uso en `application/use_cases`, puerto y adaptador en `infrastructure/adapters`, estado en `presentation/controllers` y orquestación en `presentation/bodies/metrics_view.vue`.
- La vista operativa mide 472 líneas, debajo del objetivo de 500; filtros, gráficos, KPI y ayudas están extraídos en componentes enfocados.
- La API usa `Domain.apiPath(env.metricsOverviewPath)` en `src/modules/metrics/infrastructure/adapters/metrics_api_adapter.ts:139`.
- Los errores HTTP pasan por `formatApiErrorBody`; no se añadieron URLs absolutas ni llamadas `fetch` desde la vista.
- La ruta y la navegación aceptan `dashboard.view` o `metrics.view`, pero el wrapper solo monta métricas con `metrics.view`; la API aplica el mismo permiso financiero.
- Las credenciales de desarrollo siguen protegidas por `import.meta.env.DEV` en `src/interface/config/env.ts:107` y `:112`.
- Existe un único lockfile (`package-lock.json`) y CI en `.github/workflows/ci.yml` y `.gitea/workflows/ci.yml`.

## Plan de mejoras en 4 fases

1. **A — Tooling:** conservar `npm run check` como gate y reducir las 15 advertencias ESLint preexistentes.
2. **B — Widgets:** continuar la adopción de `PageHeader`, `EmptyState`, `ConfirmDialog` y `DataTable`; esta entrega ya reutiliza los dos primeros.
3. **C — Split transacciones:** dividir `transacciones_view.vue` según los scaffolds existentes sin mezclarlo con cambios visuales.
4. **D — CI/E2E:** agregar un escenario autenticado para `Panel de métricas → filtros → cambio de tipo de gráfico` al gate Playwright.

## Qué no hacer

- No cambiar la paleta Brasper ni el layout global como parte de una limpieza estructural.
- No volver a sumar importes de monedas distintas en un único KPI.
- No duplicar las consultas de métricas en la vista ni consumir la API fuera del adapter.
- No eliminar `/metrics/weekly` o `/app/metricas` sin una ventana de compatibilidad.

## Definition of Done

- [x] Contrato backend agregado y protegido por permisos.
- [x] Panel único con cinco corredores, fechas, granularidad, estado, asesor y etiquetas múltiples.
- [x] Gráficos de barras, dona y línea seleccionables de forma independiente.
- [x] Totales y volumen por asesor, incluyendo “Sin asesor”.
- [x] Tooltip de definición, cálculo e interpretación más tooltip de valores de ApexCharts.
- [x] Estados loading, error y vacío; navegación por teclado y atributos ARIA básicos.
- [x] Ruta consolidada con métricas para roles autorizados y dashboard heredado para Marketing/usuarios con solo `dashboard.view`.
- [x] Typecheck, lint sin errores, tests, rutas API y build en verde.
