# Plan — Rangos de comisión configurables desde el backoffice

**Fecha:** 2026-09-18
**Estado:** Fases 1, 2 y 3 implementadas en el backoffice el 2026-09-19 (438 tests y `vue-tsc` en verde). Pendientes: Fase 5 (web pública) y Fase 4 (API, opcional).
**Alcance:** `com_brasper_backofice` (Fases 1 a 3) + `com_brasper_api` (Fase 4, opcional) + `com_brasper_www` (Fase 5, un fix).
**Objetivo:** que el equipo pueda crear, editar, reordenar y eliminar los tramos de monto de cada par de monedas sin tocar código ni migraciones, con validación de que los tramos no se solapen ni dejen huecos, y con soporte real para el tramo "a más" sin límite superior.

## Situación actual

Los rangos **no están hardcodeados**: cada tramo es una fila de `coin.commission` (venta) o `coin.commission_accounting` (contabilidad) con `coin_a`, `coin_b`, `percentage`, `reverse`, `min_amount` y `max_amount`. Los valores iniciales entraron por migraciones de seed del API y desde entonces la base de datos es la fuente de verdad. El backoffice y la web pública leen `GET /coin/commission` en cada carga.

Lo que falta está en la capa de presentación y en el manejo de nulos:

| Pieza | Estado | Archivo |
| --- | --- | --- |
| Crear rango desde la UI | **No existe.** El store tiene `createCommission` y el API tiene `POST /coin/commission` con permiso `commissions.create`, pero el panel no tiene botón ni formulario. | `CommissionsPanel.vue` |
| Editar y eliminar rango | Funciona, gated por `commissions.update` / `commissions.delete`. | `CommissionsPanel.vue` |
| Tramo "sin límite" (`max_amount = NULL`) | **Roto en tres puntos.** El adaptador de comisiones convierte `null` en `0`; el adaptador de la calculadora también; y al guardar, el store convierte campo vacío en `0`. Editar el tramo "10 mil a más" lo deja con máximo `0`. | `comisiones_api_adapter.ts:9`, `calculator_api_adapter.ts:50`, `use_comisiones_store_controller.ts:146` |
| Calculadora con máximo `0` | El tramo alto nunca coincide (`grossSend <= 0`). Los montos grandes caen al fallback "último tramo ordenado", que por casualidad suele ser el correcto, pero `maxAmount` del formulario queda en `0` cuando ese tramo es el mayor. | `use_calculator_store_controller.ts:23-27, 519-523` |
| Validación de solapes y huecos | No existe ni en el front ni en el API. Si dos tramos se pisan, cada calculadora toma el primero que encuentra. | — |
| Pares de monedas | Hardcodeados en el panel: USD-BRL, BRL-PEN, BRL-USD, PEN-BRL. El API limita a PEN, BRL, USD (enum). | `CommissionsPanel.vue:38-43` |
| Edición de `coin_a` / `coin_b` | Inputs de texto libre dentro de cada tramo. Permiten mover un tramo a otro par por error de tipeo. | `CommissionsPanel.vue:238-256` |
| Tests | Solo el adaptador tiene tests. El store de comisiones y el panel no. | `comisiones_api_adapter.test.ts` |
| Web pública | Mismo bug de `null → 0` en el adaptador. La lógica de selección de tramo está duplicada respecto al backoffice. | `www/.../CalculatorApiAdapter.ts:54` |

## Decisiones de diseño

1. **`max_amount` nulo significa "sin límite superior".** Es lo que ya usa el API y el seed. El dominio del backoffice pasa a tiparlo como `number | null` y toda la lógica de selección de tramo trata `null` como infinito.
2. **Los tramos se validan como escalera contigua por par.** Ordenados por `min_amount`, cada `min` debe ser igual al `max` anterior más una unidad (o exactamente igual, según se decida el criterio de inclusividad; ver abajo). Solo el último puede tener `max` nulo. Se avisa con error bloqueante en solape y con advertencia no bloqueante en hueco, porque un hueco puede ser intencional ("no operamos entre 0 y 100").
3. **Criterio de inclusividad.** El seed usa tramos cerrados por ambos lados en enteros (100-299, 300-999). Las calculadoras comparan con `>=` y `<=`, así que un monto de 299.50 no cae en ningún tramo y va al fallback. El plan propone que el validador acepte contiguidad "max anterior < min siguiente" y que la selección de tramo use `min <= monto < min del siguiente`, lo cual elimina el hueco decimal sin cambiar datos. Esto se decide con el equipo antes de la Fase 2.
4. **La lógica pura vive en `domain/`.** Ordenar, validar y elegir tramo son funciones puras sin store, en `src/modules/comisiones/domain/commission_ranges.ts`, con tests. La calculadora las importa en vez de mantener su copia.
5. **No se cambia el contrato del API en las fases obligatorias.** Crear, editar y eliminar ya existen. La validación en servidor y el reemplazo atómico por par son una fase posterior y opcional.

## Fase 1 — Corregir el tramo "sin límite" (bug, prioridad alta)

Sin esto, cualquier edición del tramo más alto lo rompe.

- `domain/models/commission.ts` y `calculator/domain/models/commission_range.ts`: `max_amount: number | null`.
- `comisiones_api_adapter.ts` y `calculator_api_adapter.ts`: `null` o ausente ⇒ `null`, no `0`. Al enviar, campo vacío ⇒ `null` en el body.
- `use_comisiones_store_controller.ts`: `validateAndSaveCommission` deja de forzar `|| 0` en `max_amount`; valida que `min < max` cuando `max` no es nulo.
- `use_calculator_store_controller.ts`: `pickCommissionBracket`, `resolveGrossFromReceive`, `sortCommissionBrackets` y `maxAmount` tratan `null` como infinito. El getter `maxAmount` devuelve el máximo finito o un tope de UI configurable si el último tramo es abierto.
- `CommissionsPanel.vue`: mostrar "Sin límite" en lugar de `0` cuando `max_amount` es nulo.
- Tests: adaptador (parse de `null`), store (guardar con máximo vacío), calculadora (monto por encima del último tramo finito cae en el tramo abierto).

## Fase 2 — Lógica de dominio de tramos + validación en el cliente

- Nuevo `src/modules/comisiones/domain/commission_ranges.ts`:
  - `sortRanges(ranges)`
  - `findRangeForAmount(ranges, amount)` con la regla de inclusividad acordada.
  - `validateRanges(ranges): { errors: RangeIssue[]; warnings: RangeIssue[] }` que detecta solapes (error), huecos (warning), más de un tramo abierto (error), `min >= max` (error), tramo abierto que no es el último (error).
  - `suggestNextRange(ranges)`: dado el último tramo, propone `min = max anterior + 1`, `max = null`, `percentage` del anterior. Sirve para prellenar el formulario de creación.
- `CommissionsPanel.vue` muestra los issues del par activo arriba de la lista, con el tramo afectado resaltado.
- La calculadora del backoffice reemplaza su lógica local por `findRangeForAmount`.
- Tests unitarios de todas las funciones del dominio con los ocho tramos del seed como fixture.

## Fase 3 — UI para crear y gestionar tramos

- Botón **"Agregar rango"** por par, visible solo con `commissions.create`. Abre un formulario inline prellenado con `suggestNextRange`. Campos: mínimo, máximo con checkbox **"Sin límite"**, porcentaje, reverse. Las monedas se toman del par activo y **no se editan** en creación.
- En edición, `coin_a` y `coin_b` pasan a ser solo lectura. Mover un tramo de par se hace eliminando y creando, que es lo que pasa en la práctica.
- Vista de escalera: además de las tarjetas actuales, una fila compacta por tramo (`100 – 299 → 40 %`) ordenada por mínimo, para ver de un vistazo si la tabla está bien armada.
- Vista previa: un input "probar monto" dentro del panel que muestra qué tramo aplicaría usando `findRangeForAmount`. Evita tener que ir a la calculadora para comprobar.
- `ComisionesStoreLike` gana `createCommission(form): Promise<boolean>` con la misma validación centralizada que `validateAndSaveCommission`.
- Estado de guardado `savingId === 'new'` ya existe; el botón muestra "Guardando…".
- Tests del store: crear con éxito, crear con solape rechazado, crear tramo abierto cuando ya hay uno.

## Fase 4 — API: validación en servidor y reemplazo atómico (opcional)

Se hace solo si el equipo quiere blindar los datos ante clientes distintos del backoffice.

- `commission_use_cases.py` (crear y actualizar): rechazar con 422 si el nuevo tramo se solapa con otro del mismo par, o si ya existe un tramo abierto. Mismo criterio para `commission_accounting_use_cases.py`.
- Nuevo `PUT /coin/commission/pairs/{coin_a}/{coin_b}` que recibe la lista completa de tramos del par y la reemplaza en una transacción. Permite que el backoffice edite la tabla entera y guarde una sola vez. Registra historial por cada fila afectada.
- Sin cambios de esquema.

## Fase 5 — Web pública: mismo fix de nulo

- `CalculatorApiAdapter.ts` de `com_brasper_www`: `max_amount` nulo ⇒ `null`; `getCommissionRateForAmount` y `getReverseFactorForAmount` tratan `null` como infinito; el getter que hoy devuelve `50000` como tope usa el máximo finito o el fallback.
- No se toca nada más de la web. La lógica sigue duplicada; unificarla en un paquete compartido queda fuera de alcance.

## Orden de implementación

1. Fase 1 (bug). Es pequeña, se puede desplegar sola y destraba todo lo demás.
2. Fase 2 y Fase 3 juntas en una rama, porque la UI de creación depende del validador.
3. Fase 5 en paralelo, en el repo de la web.
4. Fase 4 al final y solo si se aprueba.

## Fuera de alcance

- Pares y monedas dinámicos (quitar el enum de `Currency` y armar las pestañas desde datos). Solo hace falta si Brasper suma monedas nuevas.
- Rangos por cliente, por canal o por fecha de vigencia.
- Unificar la lógica de calculadora entre backoffice y web en un paquete compartido.
- Migrar los rangos de venta actuales a un seed. Hoy no hay registro de sus valores en ningún repo; conviene exportarlos y guardarlos en `docs/` como referencia, pero es una tarea aparte.

## Checklist de implementación

- [x] Fase 1: tipos `number | null`, adaptadores, store, calculadora, panel muestra "Sin límite", tests.
- [x] Fase 2: `commission_ranges.ts` con tests, panel muestra issues, calculadora usa el dominio.
- [x] Fase 3: botón y formulario de creación, monedas solo lectura en edición, escalera, probar monto, tests del store.
- [ ] Fase 5: fix de nulo en `com_brasper_www`.
- [ ] Fase 4 (opcional): validación 422 y `PUT` por par en el API.
- [x] Decisión de inclusividad: se mantiene la coincidencia inclusiva (`min <= monto <= max`) del API de venta. El validador considera contiguos dos tramos separados por una unidad o menos, así la escalera de enteros del seed no genera avisos. Un monto decimal en el hueco (299.50) cae al tramo superior por el fallback.
- [ ] Exportar rangos de venta vigentes a `docs/` como referencia.

## Implementación — 2026-09-19

Archivos tocados en el backoffice:

- `src/modules/comisiones/domain/commission_ranges.ts` (nuevo) + test: `sortRanges`, `rangeContains`, `findRangeForAmount`, `validateRanges`, `suggestNextRange`, `formatRangeBounds`.
- `src/modules/comisiones/domain/models/commission.ts`, `src/modules/calculator/domain/models/commission_range.ts`: `max_amount: number | null`.
- `comisiones_api_adapter.ts`, `calculator_api_adapter.ts`: `null` se conserva; POST/PUT envían `null`.
- `comisiones_repository.ts`: `CommissionCreateBody` tipado con números; `CommissionUpdateBody` lo extiende.
- `use_comisiones_store_controller.ts`: `CommissionForm.unlimited`, `emptyCommissionForm()`, `commissionToForm()`, `validateAndCreateCommission()`; ambas validaciones rechazan solapes y tramos abiertos duplicados usando el dominio. Test nuevo.
- `CommissionsPanel.vue`: botón "Agregar rango" (`commissions.create`), formulario prellenado con `suggestNextRange`, checkbox "Sin límite", monedas solo lectura al editar, escalera de tramos con resaltado de errores y avisos, campo "Probar monto".
- `use_calculator_store_controller.ts`: usa `findRangeForAmount` / `sortRanges` del dominio; `maxAmount` ignora el tramo abierto. Tests nuevos para el tramo "a más".
- `transaction_domain.ts`, `contabilidad_view.vue`: comparaciones `null`-safe.
