# Plan — Numeración diaria de envíos + Etiquetas de cliente nuevo

Origen: 4 audios de WhatsApp (31-jul-2026 16:51, 04-ago-2026 16:08 / 16:11 / 16:16).
Son **dos tareas independientes**. La #1 es una mejora acotada de front. La #2 es un mini-proyecto
que toca front + backend y necesita validación con el equipo de ventas antes de implementarse.

---

## Tarea 1 — La columna `#` debe reiniciarse cada día (MEJORA)

### Situación actual

En [transacciones_view.vue:3417](../src/modules/transacciones/presentation/bodies/transacciones_view.vue#L3417)
la celda de la primera columna se calcula así:

```
{{ (currentPage - 1) * perPage + rowIndex + 1 }}
```

Es un **número de fila de la lista paginada**: cuenta sobre el histórico completo (los ~200+ envíos
desde que arrancó el sistema) y además cambia si se filtra u ordena. No representa nada del negocio.

### Lo que se pide

El contador debe reiniciarse cada día calendario, según el orden en que se ingresaron los envíos:

- Primer envío del día (el de ~7:30 am) → `1`
- Segundo (~8:00 am) → `2`
- El último envío ingresado hoy → `62` (si hoy van 62), el anterior `61`, etc.

**El día es la unidad completa: de 00:00 a 23:59.** Al cambiar de día el contador vuelve a cero —
un día sin envíos muestra la lista vacía, y el primero que entre es el `1`.

**La lista se ordena del más reciente al más antiguo**, así que el número más alto queda arriba:
el envío que se acaba de registrar encabeza la tabla. Ojo con la distinción — el *orden de
pantalla* es descendente, pero la *asignación del número* es cronológica ascendente (por hora de
ingreso). Son dos cosas separadas: por eso el número no cambia aunque se reordene o filtre.

### Decisiones que hay que confirmar con ventas

| Punto | Opción propuesta |
|---|---|
| ¿Qué fecha agrupa el día? | `send_date` (fecha de envío). Alternativa: `created_at`. |
| ¿Qué define el orden dentro del día? | `created_at` ascendente (orden real de ingreso). |
| ¿Se muestra `62` o `2026-08-05 #62`? | Solo el número, con la fecha ya visible en su columna. |
| ¿El número sobrevive a filtros? | **Sí.** Es un atributo del envío, no de la vista. Si filtro por "Finalizadas" y quedan 3 filas, deben seguir mostrando `12`, `31`, `47`. |
| ¿Se recalcula si se borra un envío? | Sí, es derivado. No es un folio inmutable. Si se necesita folio inmutable, eso es otra tarea (backend). |

### ✅ Implementada (front, sin cambios de API)

**El riesgo se confirmó: el listado viene paginado por el servidor** (`skip`/`limit`, 10 por página
por defecto — ver `apiFilterParams` en la vista y `PagedTransactions` en el repositorio). O sea que
`transactionsStore.transactions` tiene solo la página visible y **no alcanza para numerar el día**.

Solución sin tocar el backend: se pide aparte el día completo, aprovechando que el API ya soporta
`send_date_from` / `send_date_to` / `limit`. Un día de operación son decenas de registros, así que
basta una petición por día visible, cacheada.

Lo que quedó implementado:

- [`transaction_domain.ts`](../src/modules/transacciones/domain/transaction_domain.ts):
  `transactionDayKey()` y `buildDailySequenceMap()` — funciones puras, 7 tests.
- [`use_transactions_store_controller.ts`](../src/modules/transacciones/presentation/controllers/use_transactions_store_controller.ts):
  estado `dailySequenceById` + acción `loadDailySequences(days)` con caché por día, y
  `resetDailySequences()` al crear / editar / borrar / importar. 5 tests.
- La vista renderiza `transactionDailyNumber(t)` en la columna `#` y observa los días visibles.

Dos detalles que aparecieron al implementarlo y quedaron resueltos en código:

- **Invalidar la caché no bastaba.** Tras guardar, si los días visibles no cambiaban el watcher no
  se disparaba y la columna quedaba en `—`. Por eso hay un contador `sequenceGeneration` que sube en
  cada invalidación y entra en la fuente del watcher.
- **El endpoint declara `limit: Query(20, ge=1, le=100)`.** La primera versión pedía `limit: 500`
  y el API devolvía 422; como el `catch` era mudo, la columna mostraba `—` en todas las filas y
  parecía que el cálculo no existía. Ahora se pagina en tandas de 100 hasta cubrir el `total` del
  día, y el error se registra en consola en vez de tragarse.
- **Envíos sin `send_date`.** La consulta del día filtra por `send_date`, así que un envío sin esa
  fecha no vuelve en ella y la tabla le muestra `—` en vez de un número equivocado. Si aparecen
  muchos casos así, la salida es el flag calculado en backend.

### Implementación (referencia)

Se resuelve **100% en front**, sin cambios de API.

1. Nueva función pura en
   [`transaction_domain.ts`](../src/modules/transacciones/domain/transaction_domain.ts):

   ```ts
   /** Devuelve un Map<transactionId, número correlativo dentro de su día>. */
   export function buildDailySequenceMap(
     transactions: Transaction[],
   ): Map<string, number>
   ```

   - Agrupa por la fecha (`YYYY-MM-DD`) de `send_date`, con fallback a `created_at`.
   - Dentro de cada grupo ordena por `created_at` asc (empate → `id`, para que sea estable).
   - Asigna `1..n`.

2. En el store [`use_transactions_store_controller.ts`](../src/modules/transacciones/presentation/controllers/use_transactions_store_controller.ts):
   un `computed` `dailySequenceById` que corre sobre la **lista completa sin filtrar**
   (importante: si se calcula sobre la lista filtrada, el número vuelve a mentir).

3. En la vista, reemplazar la expresión de la celda por
   `{{ dailySequenceById.get(t.id ?? '') ?? '—' }}` y cambiar el `title` del `<th>`
   de "Número de fila" a "Envío del día".

4. Tests en `transaction_domain.test.ts`: envíos de dos días distintos, envíos sin `send_date`,
   empates de `created_at`, lista vacía.

### Cuándo conviene pasarlo al backend

La solución actual cuesta una petición extra por día visible. Si el volumen crece y un día pasa de
unos cientos de envíos, o si aparecen muchos registros sin `send_date`, conviene pedir al API un
campo `daily_sequence` ya calculado en el listado y borrar `loadDailySequences`. Mientras tanto no
hace falta tocar el backend.

---

## Tarea 1b — Manejo de la tabla ancha ✅ implementada

Con 14 columnas la tabla obliga a buscar la barra horizontal y a apuntar al botón de tres puntos.
Tres atajos, sin quitar nada de lo que ya había:

- **Arrastrar para desplazar.** Nuevo composable
  [`use_table_drag_scroll.ts`](../src/modules/transacciones/presentation/composables/use_table_drag_scroll.ts):
  se toma la tabla con el mouse y se mueve de lado. Solo con el botón primario, y **nunca sobre
  controles** (enlaces, botones, inputs) para no robarles el clic. Hay un umbral de 4 px antes de
  considerarlo arrastre, y el clic posterior a un arrastre real se cancela — si no, soltar el mouse
  sobre una fila dispararía su acción después de haber estado solo desplazando.
- **Doble clic en la fila → editar.** Si el usuario no tiene `transactions.update`, abre la vista
  previa. Se ignora si el doble clic cayó sobre un control, y limpia la selección de texto que deja
  el doble clic antes de abrir el modal.
- **Clic derecho en la fila → el mismo menú** de los tres puntitos (Previsualizar / Editar /
  Eliminar), anclado al cursor. Se reusa el menú existente; `updateMenuPosition` ahora acepta un
  punto además de un elemento.

Cada fila lleva un `title` con la pista del atajo, para que se descubra sin manual.

---

## Tarea 2 — Etiquetas y conteo de clientes nuevos por día (MINI-PROYECTO)

### El problema real

Antes del backoffice, ventas trabajaba en un grupo de WhatsApp y ahí anotaba
`envío 001 — cliente nuevo`. Con eso sabían, al cierre del día, cuántos clientes nuevos habían
entrado y cuántos completaron su envío. Ese dato alimenta las campañas de marketing (se lleva a
un Drive aparte, compartido entre ventas y marketing).

Hoy el backoffice **no expone esa información**, y la recuperan a mano: reconocen un nombre que no
les suena y lo copian al Drive. No escala, y las campañas arrancan este mes.

### Lo que se pide, en orden de importancia

1. **El número de clientes nuevos del día** — es el dato crítico, no el nombre.
2. **Cuántos de esos nuevos finalizaron** su envío (ej. "entraron 20, finalizaron 10").
3. **Ver a simple vista** en la lista del día qué filas son de cliente nuevo (etiqueta de color).
4. **Poder etiquetar al momento de registrar** el envío, desde la pantalla de transacciones.
5. **Etiquetas libres** además de "Cliente nuevo" (la idea del usuario es un sistema de etiquetas
   genérico, coloreado).

### Decisión de diseño clave: ¿etiqueta manual o derivada?

Hay dos formas de saber que un cliente es nuevo, y conviene tener las dos:

**a) Derivada (automática) — recomendada como base.**
Un cliente es nuevo si el envío en cuestión es su **primer envío registrado**. El backend ya tiene
`user_id` y `created_at` de cada transacción: el dato existe, solo no está expuesto. No requiere
que nadie recuerde marcar nada, no se ensucia, y es retroactivo — se puede calcular el histórico
completo desde el día 1.

**b) Manual (etiquetas) — encima de la derivada.**
Para los casos que la automática no cubre: cliente que escribió por WhatsApp y no llegó a
completar (no existe en el sistema, no tiene transacción), cliente recuperado, cliente de una
campaña específica, etc. Aquí sí hace falta el sistema de etiquetas libre.

> **Nota importante para ventas:** el caso "escribieron por WhatsApp pero no completaron" **no puede
> vivir en el módulo de transacciones**, porque esas personas no tienen transacción. Si se quiere
> medir ese embudo completo, es una tercera tarea (registro de leads), y hay que decidir si vale la
> pena o si se sigue llevando por WhatsApp.

### Alcance propuesto — Fase 1 (lo que resuelve el 80% con el mínimo)

**Front + un solo campo de backend.**

1. **Badge "Nuevo" derivado en la tabla.**
   Chip amarillo en la fila cuando la transacción es la primera de ese `user_id`.
   Si toda la lista está en memoria se calcula en front (misma técnica que la Tarea 1);
   si no, se pide al backend un flag `is_first_transaction` en el listado.

2. **Tira de KPIs del día, arriba de la tabla.**
   `Clientes nuevos hoy: 5` · `Finalizaron: 3` · `Conversión: 60%`.
   Se calcula sobre la lista del día ya cargada. "Finalizó" = estado `completed`
   (ver `normalizeTransactionStatus`).

3. **Filtro `Solo clientes nuevos`** en la barra de filtros existente
   ([`TransactionFiltersBar.vue`](../src/modules/transacciones/presentation/components/TransactionFiltersBar.vue)).

4. **Exportar el día a CSV** con la columna "nuevo" incluida — reemplaza el copy-paste manual al
   Drive de ventas/marketing. Esto es lo que les ahorra el trabajo hoy.

### ✅ Fase 2 implementada (etiquetas libres + catálogo administrable)

Requiere backend. Tres piezas:

**a) El campo en la transacción.**
`tags: string[]` (ids de etiqueta) en `POST`/`PUT`/listado. Ojo con el patrón append/keep de los
vouchers: las etiquetas deben **reemplazarse**, no acumularse.

**b) El selector al registrar.**
En el paso **«Datos»** del wizard
([`CREATE_FLOW_STEPS`](../src/modules/transacciones/presentation/bodies/transacciones_view.vue#L348)),
dentro de la sección «Cliente y cuentas», junto al campo Cliente. Es exactamente donde el usuario
lo pidió: *"cuando estoy agregando al cliente nuevo… ahí mismo que haya una sección de etiquetas"*.
En la tabla: chips en la fila con edición rápida por popover, sin abrir el wizard completo.

**c) La pantalla de configuración del catálogo.**
Nueva ruta **`/app/etiquetas`**, en el grupo **Configuración** del menú — al lado de «Banner Home»,
«Blog» y «Permisos de roles» —, breadcrumb `Configuración > Etiquetas`, detrás de permisos nuevos
`tags.view` / `tags.create` / `tags.update` / `tags.delete` en
[`permissions.ts`](../src/modules/auth/domain/models/permissions.ts). Así ventas **usa** las
etiquetas y solo quien administra **cambia el catálogo**.

Cada etiqueta tiene: nombre, color (de una paleta cerrada de 8 — no un color-picker libre, para que
no queden chips ilegibles), **activa** y **«cuenta como cliente nuevo»**.

Dos reglas de negocio que salieron al maquetarlo y conviene fijar desde el principio:

- **Solo una etiqueta puede tener el flag «cuenta como cliente nuevo».** Es la que alimenta los KPIs
  del día y la columna del CSV. Sin ese flag el indicador queda sin fuente y hay que decirlo en
  pantalla, no fallar en silencio.
- **Desactivar ≠ borrar.** Una etiqueta inactiva deja de ofrecerse al registrar, pero sigue visible
  en las transacciones que ya la tenían — si no, se pierde el histórico de las campañas viejas.
  Borrar sí la quita de todas las transacciones, y hay que advertir cuántas afecta.

Los KPIs y el filtro pasan a contar por la etiqueta marcada, no solo por el "nuevo derivado".

### ✅ Fase 2b implementada (alta rápida de cliente)

Pedido explícito: poder crear el cliente **al vuelo, con solo el nombre**, sin salir de la
transacción.

**Situación actual.** El botón ya existe: en el paso «Datos», junto al campo Cliente, hay un botón
que abre [`UsuarioCreateFormModal`](../src/interface/components/UsuarioCreateFormModal.vue)
(`openTransactionClientModal`). El problema es que ese modal es el alta completa — email, nombres,
apellidos, rol, código telefónico, teléfono, foto, identificaciones. Para el ritmo de ventas a las
7:30 de la mañana es demasiado.

**Propuesta.** Un modo **«alta rápida»** del mismo modal (prop `variant="quick"`, para no duplicar
componente):

- Un solo campo obligatorio: **nombre o razón social**. Teléfono opcional.
- El usuario se crea con rol `client` y queda marcado como **perfil incompleto**.
- Queda seleccionado en la transacción de inmediato y se le aplica sola la etiqueta «cliente nuevo»
  — un alta rápida es, por definición, un cliente nuevo.
- La transacción **no se bloquea** por el perfil incompleto. Sí falta la cuenta destino: hay que
  decidir si se permite guardar sin ella o se exige ahí mismo (el mockup permite escribirla libre).

**Dónde se ve el pendiente:**

- Chip naranja **«⚠ perfil incompleto»** junto al nombre en la fila de la transacción.
- En `/app/usuarios`, un filtro **«Perfil incompleto (N)»** con el mismo chip, para que alguien los
  complete después sin frenar la operación del día.
- Columna «Perfil incompleto» en el CSV.

**Backend.** Hace falta un flag `profile_incomplete` (o derivarlo: sin email y sin documento) y que
el `POST` de usuarios acepte crear con solo nombre — hoy hay que verificar qué campos exige de
verdad el API, porque el front ya tiene el email como opcional.

### Alcance propuesto — Fase 3 (opcional)

Widget en el dashboard ([`dashboard_view.vue`](../src/modules/dashboard/presentation/bodies/dashboard_view.vue))
con la serie de clientes nuevos por día de los últimos 30 días. Solo si después de la Fase 1 siguen
queriendo la vista de tendencia; puede ser que el CSV les baste.

### Backend necesario

Este repo es solo el front. Lo que hay que coordinar con `com_brasper_api`:

| Fase | Cambio en API |
|---|---|
| 1 | *Ninguno* si el listado trae todo en memoria. Si no: flag `is_first_transaction` en el listado de transacciones. |
| 2 | Campo `tags` en `POST`/`PUT`/listado de transacciones. Cuidado con el patrón append/keep de vouchers — las etiquetas deben reemplazarse, no acumularse. |
| 2 | CRUD `tags/` (nombre, color, activa, cuenta_como_nuevo) + los cuatro permisos nuevos. |
| 2b | `POST users/` aceptando solo nombre + flag `profile_incomplete`. |
| 3 | Endpoint agregado `new-clients-per-day?from=&to=`. |

### Estimado

| Fase | Front | Backend |
|---|---|---|
| 1 | 1–2 días | 0 (o 2 h por el flag) |
| 2 | 2–3 días | 1–1.5 días |
| 2b | 0.5–1 día | 0.5 día |
| 3 | 1 día | 0.5 día |

---

## Mockup para validar antes de codificar

Antes de tocar código de producción hay un mockup navegable en
[`public/mockup-etiquetas/index.html`](../public/mockup-etiquetas/index.html).

Replica la pantalla real, no una tabla inventada: **las mismas 14 columnas** de
`/app/transacciones` (`#`, Verificada, Código, N° operación, Cliente, Razón social, Monto de envío,
Cuenta destino, Monto a recibir, Tipo cambio, Estado, Envío (fecha/hora), Comp. envío, Comp. pago)
y **el mismo wizard de 3 pasos** de `CREATE_FLOW_STEPS` — Cotización → Datos → Comprobantes — con
las secciones y etiquetas de campo tal como están hoy ("Cliente y cuentas", "Importes y
condiciones", "Fechas", "Estado en el sistema"). Los estados usan `TRANSACTION_STATUS_LABELS`.

Sirve para que ventas pruebe las dos cosas y diga qué cambiar:

- Interruptor para comparar la numeración **global (hoy)** vs **diaria (propuesta)** en la misma tabla.
- Etiquetas clicables en cada fila, con el catálogo de colores propuesto.
- Interruptor de **ubicación de las etiquetas**: bajo el nombre del cliente (no ensancha la tabla —
  ya son 14 columnas) o en columna propia. Es una decisión abierta; que elijan ellas.
- El selector de etiquetas dentro del **paso "Datos"** del wizard, junto al campo Cliente — que es
  exactamente donde el usuario pidió marcarlo ("cuando estoy agregando al cliente nuevo").
  Al marcar «Cliente nuevo» aparece un aviso de que ese envío contará en el KPI del día.
- El **alta rápida de cliente**: el botón `+` junto al campo Cliente abre un modal con un solo campo
  obligatorio (nombre). Al guardar, el cliente queda seleccionado, marcado «⚠ perfil incompleto» y
  con la etiqueta de cliente nuevo ya puesta. Aparece en la sección «Clientes creados a la rápida»,
  que es la maqueta del filtro que iría en `/app/usuarios`.
- La **configuración de etiquetas** funcionando de verdad: crear, renombrar, recolorear (paleta de
  8), activar/desactivar, borrar, y mover el flag «cuenta como cliente nuevo». Todo lo que cambien
  ahí se refleja al instante en la tabla, el wizard, los KPIs y el CSV — así prueban las reglas
  antes de que se codifiquen.
- Los KPIs del día reaccionando en vivo a lo que se etiqueta y a lo que se crea.
- Filtro "solo clientes nuevos" y exportación a CSV con todas las columnas + la columna "nuevo".
- Un formulario de comentarios al pie con cinco preguntas concretas, para que cada persona escriba
  qué le falta y lo copie/envíe.

Los cambios que hagan en el mockup se guardan en el navegador (`localStorage`), así que pueden
cerrarlo y seguir después. **No toca la API ni datos reales** — los datos son inventados.

### Cómo abrirlo

Con el dev server corriendo (`npm run dev`), en:

```
http://localhost:5173/mockup-etiquetas/
```

O abriendo el archivo directamente en el navegador con doble clic — es autocontenido, no necesita
servidor ni internet.

---

## Orden sugerido de trabajo

1. **Verificar** si el listado de transacciones viene completo o paginado desde el backend.
   Esta respuesta define la implementación de las dos tareas.
2. **Implementar Tarea 1** (numeración diaria) — es independiente, de bajo riesgo, y desbloquea
   el pedido más viejo (viene del 31 de julio).
3. **Circular el mockup** con ventas y recoger comentarios. Concretamente, hay que cerrar:
   - ¿Basta con "nuevo" derivado automático, o de verdad necesitan etiquetar a mano?
   - ¿Las etiquetas van bajo el nombre del cliente o en columna propia?
   - ¿El CSV del día les resuelve el pase al Drive, o quieren integración directa?
   - ¿Qué otras etiquetas usarían realmente, además de "cliente nuevo"?
4. **Fase 1 de la Tarea 2** con lo que salga de esa conversación.
5. Fases 2 y 3 solo si el uso real las justifica.

---

## Estado de la implementación (2026-08-09)

### `com_brasper_api` — etiquetas

| Pieza | Archivo |
|---|---|
| Modelos `Tag` + puente `TransactionTag` | `app/modules/transactions/domain/models.py` |
| Schemas y paleta cerrada `TAG_COLORS` | `app/modules/transactions/application/schemas/tag_schema.py` |
| Puerto e implementación del repositorio | `interfaces/tag_repository.py`, `infrastructure/tag_repository.py` |
| Casos de uso CRUD | `application/use_cases/tag_use_cases.py` |
| Rutas `/transactions/tags/` | `adapters/router/tag_routes.py` |
| Migración (escrita, **no ejecutada**) | `app/db/migrations/versions/2026_08_09_1200_00-062_transaction_tags.py` |

`tag_ids` viaja en el `GET` del listado, y se acepta en `POST`/`PUT` tanto en JSON como en
multipart. Las etiquetas se **reemplazan**, no se acumulan — al revés que los comprobantes.
Omitir el campo en un `PUT` deja las etiquetas como estaban.

La migración crea las dos tablas y siembra las cinco etiquetas del mockup. **Está escrita pero no
se ha ejecutado contra ninguna base de datos**, ni se ha hecho deploy.

### Backoffice — etiquetas

| Pieza | Archivo |
|---|---|
| Modelo, paleta y helper de color | `src/modules/transacciones/domain/models/tag.ts` |
| Adaptador HTTP | `infrastructure/adapters/tags_api_adapter.ts` |
| Store Pinia | `presentation/controllers/use_tags_store_controller.ts` |
| Pantalla de configuración | `presentation/bodies/etiquetas_view.vue` |
| Ruta `/app/etiquetas` + menú | `src/interface/router/index.ts`, `src/interface/layout/app_layout.vue` |
| Permisos `tags.*` | `src/modules/auth/domain/models/permissions.ts` |

El selector de etiquetas quedó en el paso **Datos** del wizard, junto al cliente; los chips se
muestran bajo el nombre en la tabla (la opción que no ensancha las 14 columnas — sigue abierta a
cambio si ventas prefiere columna propia).

`parseTagIds` normaliza también texto: el parser mezcla el registro crudo del API, así que si
devolviera `undefined` ante un `tag_ids` string, ese string llegaría al modelo y `.map` reventaría
en la tabla.

### Backoffice — alta rápida de cliente

No hizo falta tocar el backend: `UserCreateCmd` ya tiene **todos los campos opcionales**, así que
el API acepta crear con solo el nombre.

- `UsuarioCreateFormModal` acepta `variant="quick"`: deja solo nombre (obligatorio) y teléfono
  (opcional), y avisa de lo que queda pendiente. El botón `+` junto a Cliente en el wizard ya lo usa.
- **`profile_incomplete` se deriva, no se guarda**: un cliente está incompleto si no tiene email ni
  documento (`isClientProfileIncomplete` en `parse_user.ts`). Evita una segunda migración y un
  backfill, y el dato es igual de fiable porque no hay forma de tener email o documento sin haber
  pasado por el alta completa.
- La fila de la transacción muestra el chip naranja «perfil incompleto».

**Pendiente de esta fase:** el filtro «Perfil incompleto (N)» en `/app/usuarios`. El helper ya está
listo para engancharlo.

### Verificación

| Qué | Resultado |
|---|---|
| `pytest` (API) | 142 pasan, 1 falla — `test_r2_live_save_read_delete_cycle`, **preexistente**: falla igual en árbol limpio |
| `vue-tsc --noEmit` | Sin errores |
| `vitest run` | 213 pasan (27 archivos) |
| `npm run build` | OK |
| Smoke CRUD sobre SQLAlchemy real | Duplicado rechazado, flag exclusivo, activa≠borrada, reemplazo sin acumular, borrado que desaparece de las transacciones |
| Smoke HTTP de las rutas | `POST` 201 · `GET` · duplicado 400 · `PUT` · `only_active` · `DELETE` 204 |

Para el smoke se instaló `aiosqlite` en el venv del API (solo desarrollo; **no** se tocó
`requirements.txt`).

**No verificado en el navegador:** la app pide login y no puedo autenticarme. Falta comprobar
visualmente la pantalla de etiquetas, el selector en el wizard y los chips en la tabla.


---

## Ajustes tras la primera revisión en pantalla (2026-08-09)

### La lista ahora es diaria por defecto

Traer el día completo aparte para numerar era trabajo de más: si la operación es diaria, la lista
debería serlo también. Ahora la pantalla abre en **«Por día», con el día de hoy**, y muestra el día
en grande («Domingo 9 de agosto de 2026 · hoy»), con `‹ ›` para moverse, un selector de fecha,
«Ir a hoy», y el conteo de envíos del día.

El interruptor **«Todas»** levanta el recorte y devuelve el histórico completo, reactivando los
campos «Envío desde/hasta» (que en modo día sobran, porque el día ya define el rango).

Ventajas sobre lo anterior: el listado trae solo lo del día, la numeración `#` coincide con lo que
se ve, y el filtro por día deja de estar escondido entre dos campos de fecha.

### Selector de etiquetas: por qué no aparecía

Estaba oculto tras `v-if="availableTags.length"`. Como **la migración `062` no se ha ejecutado**,
la tabla `transaction.tags` no existe, el `GET /transactions/tags/` falla y el catálogo llega
vacío — así que el bloque entero desaparecía y parecía que la función no se había implementado.

Ahora el bloque **se muestra siempre**, con dos estados explícitos:
- si el endpoint falla, se ve el error;
- si no hay etiquetas activas, un enlace a *Configuración > Etiquetas* para crear la primera.

Un fallo de infraestructura no puede verse igual que «esto no existe».

### «Perfil incompleto» en Usuarios

Estaba pendiente y ya quedó:
- chip naranja junto al nombre en `/app/usuarios` (solo para clientes: marcar asesores sin
  documento ensuciaría la lista con avisos que nadie va a atender);
- filtro **«Perfil incompleto (N)»** en la barra, que aparece solo si hay alguno. El conteo es
  global, no del filtro activo, porque es un pendiente de trabajo, no una vista.
