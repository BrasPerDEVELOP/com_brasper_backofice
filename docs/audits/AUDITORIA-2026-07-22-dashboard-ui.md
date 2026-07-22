# Auditoría 2026-07-22 — UI del Dashboard: inconsistencias y mejoras

**Alcance:** [dashboard_view.vue](../../src/modules/dashboard/presentation/bodies/dashboard_view.vue) (796 líneas, vista única del módulo) contrastada contra las convenciones del resto del backoffice (cuentas, usuarios, transacciones, metrics).
**Método:** revisión de código y comparación de patrones; sin cambios aplicados.

## Hallazgo principal: el dashboard habla otro idioma visual

El resto del backoffice es sobrio y plano: cards blancas, borde `#e5e7eb`, `rounded-xl`, textos `#1f2937`/`#6b7280`, acento `brasper-indigoStrong`, títulos `text-2xl font-medium`. El dashboard usa un lenguaje completamente distinto — gradientes en hero, números y barras (`bg-clip-text text-transparent`), blobs radiales de fondo con `blur-3xl`, glassmorphism (`bg-white/70 backdrop-blur-md`), glows (`shadow-[0_0_8px_…]`), tipografía `font-black text-6xl`. Parece otro producto: el usuario percibe un salto de calidad/marca cada vez que entra o sale del dashboard.

Agrava la inconsistencia que **ya existe un componente KPI alineado al sistema** — [MetricKpiCard.vue](../../src/modules/metrics/presentation/components/MetricKpiCard.vue) (card blanca, borde `#e5e7eb`, acento lateral) — y el dashboard no lo reutiliza: hay dos estilos de KPI conviviendo en la misma app.

## Inconsistencias de UI (con evidencia)

1. **Dos sistemas de color.** El dashboard usa la paleta stock de Tailwind con opacidades (`amber-100/90`, `violet-500`, `emerald-950`, `slate-*`, `rose-*`, `sky-*`); el resto usa hex fijos + tokens `brasper-*`. Además, los colores de estado de las barras (líneas 719–736) no coinciden con los badges de estado que el asesor ve en transacciones.
2. **Tipografía fuera de escala.** `text-4xl/5xl/6xl font-bold/black` en KPIs y contadores (líneas 290, 437, 574) contra los `text-2xl font-medium` del resto; micro-texto de 10–11px en múltiples cards (432, 457, 543).
3. **Hack de layout.** `-mx-2 -mt-2` (línea 221) para escapar del padding del `app_layout` — acoplamiento frágil: cualquier cambio del layout rompe el encuadre solo en esta vista.
4. **Única vista con animación de entrada** (`dashboard-fade`) y con hero degradado; ninguna otra vista los tiene.

## Problemas de UX y claridad de datos

5. **Jerga técnica expuesta al asesor.** Las cards muestran claves crudas del API en `<code>`: `verification`, `completed`, `checked`, "Campo `status` por transacción" (líneas 457, 496, 536–537, 707). Los labels oficiales en español ya existen (`TRANSACTION_STATUS_LABELS`) y solo se usan en el desglose.
6. **Terminología de estados no alineada.** "Verificado (revisión)", "Finalizadas", "En verificación: verification + pendiente (legado)" — mezcla de nombres propios del dashboard con los labels oficiales ("Verificado", "Finalizada", "En verificación", "Pendiente (legado)").
7. **Affordance inconsistente.** De las 5 KPI cards de operación, 1 es link (Transacciones) y 4 son estáticas con estilo idéntico; el pill "Ver →" solo aparece en hover (línea 432) — invisible en táctil. Lo más grave: **"En verificación" es la cola de trabajo del asesor y no enlaza** a transacciones filtradas.
8. **Volumen sin unidad de moneda.** "Volumen liquidado Origen/Destino" (líneas 545, 551) muestra montos sin decir PEN/BRL — un número agregado ambiguo no sirve para decidir.
9. **Barras engañosas.** `width: Math.max(8, …)%` (línea 739): un estado con 1% de participación se pinta como 8% — la proporción visual miente.
10. **Fuentes de datos contradictorias lado a lado.** "Clientes" sale de `clientUsers.length` (endpoint `name-list`) y "Usuarios totales" de `fetchUsers().length` (líneas 678, 686); si difieren en filtros, el panel muestra números incoherentes entre sí.
11. **Errores enterrados.** Todos los fallos de carga colapsan en una línea al **final** de la página ("Algunos datos pueden estar incompletos…", línea 754+). Si cupones falla, arriba se ve un `0` plausible y el aviso queda fuera del viewport. No hay estado de error por card.
12. **Carga todo-o-nada.** Un solo spinner bloquea la vista completa (línea 269); no hay skeletons por sección. El CTA del hero aparece recién al terminar la carga (`v-if="!loading"`, línea 257) → salto de layout.
13. **Sin frescura ni refresco.** No hay "actualizado a las HH:MM" ni botón de refrescar; los datos quedan congelados desde el mount.

## Rendimiento que degrada la UX

14. **Para pintar contadores se descarga medio backoffice.** El mount carga todas las cuentas (hoy recorre la paginación completa), bancos, clientes, cupones, comisiones, tasas y **todos los usuarios** solo para hacer `.length` (líneas 193–214). El tiempo de spinner crece linealmente con los datos. Las transacciones ya usan un endpoint agregado (`getTransactionMetrics`) — es el patrón correcto para el resto (endpoint de conteos o carga perezosa por sección).
15. **Violación de capas** (ya marcada en FEATURE_MAP): la vista instancia adapters directamente (`new BlogApiAdapter()`, `new TransactionsApiAdapter()`, `fetchUsers`) sin pasar por store/use case — errores y caché quedan fuera del patrón común.

## Accesibilidad

16. Texto degradado (`bg-clip-text`) con contraste variable; `text-white/75` sobre gradiente (línea 577); información de estado transmitida solo por color; affordances solo-hover; tamaños de 10px por debajo del mínimo legible.

## Recomendaciones priorizadas

| # | Acción | Impacto |
|---|--------|---------|
| 1 | Alinear el dashboard al sistema visual del resto (cards planas, tokens brasper) reutilizando/extendiendo `MetricKpiCard`; hero reducido a franja simple | Coherencia de producto |
| 2 | Hacer cada KPI accionable con link a la vista filtrada (En verificación → transacciones filtradas) y affordance visible sin hover | El dashboard pasa de "adorno" a punto de partida del trabajo diario |
| 3 | Eliminar jerga técnica; usar `TRANSACTION_STATUS_LABELS` en cards; unidades de moneda en volúmenes | Comprensión del asesor |
| 4 | Endpoint agregado de conteos (o carga perezosa por sección) + skeletons por card + error visible por card | Tiempo de carga y confianza en los datos |
| 5 | Barras con proporción real (marcador mínimo, no ancho inflado) y unificar la fuente de conteo de usuarios | Honestidad visual |
| 6 | Marca de tiempo "Actualizado HH:MM" + botón refrescar | Frescura percibida |

Nota: el punto 4 requiere coordinación con `com_brasper_api` (endpoint de conteos); el resto es solo frontend.

---

## Anexo (mismo día) — Sidebar y vistas CRUD

Extensión de la auditoría a [app_layout.vue](../../src/interface/layout/app_layout.vue) y a las vistas CRUD (usuarios, transacciones, contabilidad, cupones, tasas, comisiones, blog, banner).

### Lo que está bien (patrones ya consistentes)

- Botón primario `bg-brasper-indigoStrong` en todas las vistas.
- Confirmaciones con `ConfirmDialog` propio (no hay `window.confirm`).
- Tablas con `overflow-x-auto` (no se rompen en pantallas angostas).
- Menú y rutas gateados por permisos de forma uniforme.

### Sidebar

1. **Ícono duplicado**: Blog usa `icon: "ledger"`, el mismo que Contabilidad (`app_layout.vue:50` aprox) — dos ítems del menú con el mismo ícono.
2. **12 ítems planos sin agrupación**: operación (transacciones, contabilidad), configuración (tasas, comisiones, cuentas), marketing (banner, blog, cupones) y análisis (panel, métricas) van intercalados sin secciones ni separadores. El dashboard sí agrupa por "Operación/Configuración", pero el menú no — escaneo lento y sin jerarquía para el asesor.

### Inconsistencias transversales entre CRUDs

3. **Títulos de página con 3 estilos**: `text-2xl font-semibold text-[#1f2937]` (cuentas, roles) vs `text-[#232b4d]` (cupones, perfil, contabilidad, blog, transacciones) vs `text-3xl … text-[#111827]` (banner) y `font-medium` (usuarios). Tres colores, dos pesos y dos tamaños para el mismo elemento.
4. **Cabeceras de tabla con 3 estilos**: `bg-[#dbeafe]` (transacciones, contabilidad, usuarios) vs `bg-[#f9fafb]` (tabla nueva de usuarios-cuentas) vs `bg-neutral-50` (blog).
5. **3–4 sistemas de gris**: hex fijos (`#e5e7eb/#6b7280`), `neutral-*` (blog), `slate-*` (dashboard y cuentas nuevas) — mismos roles visuales, tokens distintos.
6. **Dos patrones de paginación**: flechas `« ‹ › »` (transacciones, contabilidad, usuarios) vs botones "Anterior/Siguiente" (usuarios-cuentas).
7. **Blog usa `<select>` nativo** (4 instancias) mientras el resto usa `AppDropdown` — sin buscador y con estilo de sistema operativo distinto al resto.
8. **Botones muertos en usuarios**: los toggles decorativos "Vista tabla"/"Vista cuadrícula" (`usuarios_view.vue:365-374`) no hacen nada — son los mismos que ya se retiraron de cuentas.
9. **Paradigmas de listado distintos sin criterio explícito**: tablas (usuarios, transacciones, contabilidad, blog, cuentas) vs grid de cards (tasas, comisiones) vs listado propio (cupones). Aceptable por tipo de dato, pero las acciones difieren (menú ⋮ vs botones inline) y los estados vacíos no comparten formato.

### Recomendación

El grueso del problema sigue siendo el dashboard (otro lenguaje visual completo). Para los CRUDs y el sidebar basta una pasada corta de homogeneización: un estilo único de H1 y de cabecera de tabla, un solo patrón de paginación, AppDropdown en blog, quitar los toggles muertos de usuarios, ícono propio para Blog y agrupar el menú en 3–4 secciones. Idealmente, documentar esos patrones (H1, tabla, paginación, chips de estado) como mini-guía en `docs/` o extraer componentes compartidos (`PageHeader`, `DataTable`, `TablePagination`) para que no vuelvan a divergir.

---

## Anexo — Configuración de cuentas propias de Brasper

> **Resuelto en frontend (2026-07-22):** se añadió `/app/cuentas-brasper`, entrada propia en el sidebar y permisos `company_bank_accounts.*`, reutilizando el CRUD de `transactions/banks/`. Sigue siendo recomendable separar banco, entidad legal y cuenta operativa en el backend cuando se pueda evolucionar el contrato.

### Veredicto

**No existe una pantalla ni un módulo explícito para configurar las cuentas operativas propias de Brasper.** La vista `/app/cuentas` administra cuentas bancarias asociadas a usuarios/clientes (`BankAccount.user_id`) y su propio texto dice “Usuarios y cuentas bancarias”; no representa con claridad tesorería, cuentas recaudadoras o cuentas pagadoras de la empresa.

Sí existe una implementación parcial y escondida: el recurso API `transactions/banks/`, presentado como **“Catálogo > Bancos”**, guarda por fila `company`, `bank`, `currency`, `country` y `account`. El ejemplo de razón social es “Brasper 21 SAC”. Sin embargo, solo se llega a este CRUD desde el botón **Gestionar** dentro del formulario de creación de una cuenta bancaria o desde el flujo de transacciones. No tiene ruta propia ni entrada en el sidebar.

### Problemas funcionales

1. **Conceptos mezclados.** Una fila llamada “Banco” contiene también razón social y número de cuenta. Eso mezcla el catálogo de instituciones (BCP, Interbank, etc.) con una cuenta corporativa concreta de Brasper.
2. **Descubribilidad casi nula.** Para cambiar una cuenta propia hay que iniciar otro flujo y encontrar “Gestionar”; un administrador no tiene una sección “Configuración de empresa” o “Cuentas Brasper”.
3. **Modelo incompleto para operación.** El adapter contempla `pix` y `social_actor`, pero el formulario editable solo expone razón social, banco, moneda, país y cuenta. No hay alias visible, tipo de cuenta, CCI, titular/RUC estructurados, estado activo, prioridad/orden, propósito (recaudación, pago, liquidación), límites ni instrucciones de pago.
4. **Sin separación por entidad legal.** `company` es texto libre por fila; no existe un registro corporativo reutilizable para “Brasper 21 SAC” u otras razones sociales. Esto favorece duplicados y variantes del mismo nombre.
5. **Permisos ambiguos.** No existe permiso específico para configuración corporativa. El CRUD reutiliza el contexto de `bank_accounts`, aunque modificar una cuenta propia de tesorería es más sensible que crear o editar la cuenta de un cliente.
6. **Riesgo de integridad.** Crear, editar o eliminar una fila del catálogo puede afectar los selectores usados por nuevas transacciones. La UI no explica dependencias ni bloquea la eliminación de registros ya referenciados.

### Qué debería existir

Una sección de administración separada, por ejemplo **Configuración > Cuentas Brasper**, con permiso propio (`company_bank_accounts.view/create/update/delete`). Debe distinguir:

- **Entidades legales de Brasper**: razón social, RUC/documento, país y estado.
- **Bancos**: catálogo de instituciones, sin datos de una cuenta particular.
- **Cuentas operativas**: entidad legal + banco + moneda + número/CCI/PIX + propósito + estado + prioridad.

Las transacciones deberían consumir únicamente cuentas operativas activas y compatibles con país, moneda y dirección del flujo. Esto probablemente requiere contrato y modelo nuevos en `com_brasper_api`; no conviene resolverlo solo renombrando la pantalla actual, porque hoy `transactions/banks/` ya combina dos conceptos distintos.
