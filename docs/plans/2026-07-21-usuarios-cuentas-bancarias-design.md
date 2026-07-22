# Usuarios y cuentas bancarias + retiro de Mundial 2026

> Implementado el 2026-07-21. Este documento conserva las referencias de retiro como especificación histórica; el módulo ya no forma parte del código activo.

## Objetivo

Reorganizar `/app/cuentas` alrededor de los usuarios (quién tiene cuentas, cuántas, cuáles, quién no tiene) y rediseñar el flujo de creación para que el asesor entienda en todo momento **para quién** crea la cuenta, **qué tipo** de cuenta está creando y **qué datos** son obligatorios según el país. Adicionalmente, retirar el módulo Mundial 2026, que está aislado y no afecta transacciones ni cupones.

## Hallazgos del código actual (por qué el flujo confunde al asesor)

Auditoría de [cuentas_bancarias_view.vue](../../src/modules/cuentas-bancarias/presentation/bodies/cuentas_bancarias_view.vue), [CuentaBancariaCreateFormModal.vue](../../src/interface/components/CuentaBancariaCreateFormModal.vue) y [CuentaBancariaCreateForm.vue](../../src/interface/components/CuentaBancariaCreateForm.vue):

1. **Contexto invisible.** País, flujo (origen/destino) y tipo de titular se heredan de los **filtros de la lista** y llegan al modal como props no editables; solo se muestran en un chip informativo. Si el filtro estaba en `PE · Destino · Natural`, la cuenta se crea así aunque el asesor quisiera otra cosa — tendría que cerrar el modal, cambiar tres filtros y reabrir.
2. **Obligatoriedad accidental.** `requireAccountNumber = !lockedUserId` (`CuentaBancariaCreateForm.vue:115`). Se diseñó para el alta desde transacciones, pero en el nuevo flujo por usuario (`lockedUserId` siempre presente) **ningún identificador de la cuenta sería obligatorio**: se podría guardar una cuenta sin número, sin CCI y sin PIX.
3. **Campos fantasma.** `cpf`, `pix_key_type`, `pix_key_confirmation` y `cci_number_confirmation` existen en el estado del formulario y en el payload, pero **no tienen input en el template** — siempre viajan como `null`.
4. **Campos irrelevantes por país.** CCI (PE) y PIX (BR) se muestran lado a lado sin importar el país seleccionado. Para BR ni siquiera se piden el tipo de clave PIX ni el CPF.
5. **Bancos sin filtrar.** `BankOption.country` existe (`banks_api_adapter.ts:9`) pero `bankOptions` en el modal lista todos los bancos: se puede asignar un banco brasileño a una cuenta peruana.
6. **Errores globales.** La validación emite un único mensaje al pie (`validationError` → `cuentasStore.error`); no hay validación por campo ni foco al campo inválido.
7. **Endpoints reales.** Usuarios cliente: `user/name-list/?role=client` vía `fetchClientUsers()` (no `GET user/`). Cuentas: `transactions/bank-accounts/`. `UserOption` hoy solo trae `id/name/email/role`; el documento está disponible en `parseUserListItem` (`identifications`) pero se descarta en la proyección.
8. **Recarga tras crear.** `createBankAccount` en el store recarga **todas** las cuentas sin filtros y luego hace upsert; el nuevo composable debe ser el dueño del refresco para actualizar contadores y panel sin doble llamada.

## Fase 1 — Vista «Usuarios y cuentas» (master–detail)

Se mantiene la ruta `/app/cuentas`. La pantalla pasa a ser un master–detail:

```
┌─ Usuarios y cuentas ──────────────────────────────── [+ Crear cuenta] ┐
│ [🔍 Nombre, correo o documento…]  (Todos 128) (Con cuentas 97) (Sin cuentas 31) │
├────────────────────────────────────────────┬──────────────────────────┤
│ Cliente          Documento   Cuentas  Est. │  Juan Pérez García       │
│ ─────────────────────────────────────────  │  juan@mail.com · DNI 415…│
│ ▸ Juan Pérez     DNI 4151…   3  PE·BR  ✓  │  [+ Crear cuenta]        │
│   juan@mail.com                            │ ┌ PERÚ · Destino ──────┐ │
│ ▸ Ana Souza      CPF 123…    1  BR     ✓  │ │ BCP (PEN)            │ │
│   ana@mail.com                             │ │ N° 1912… [copiar]    │ │
│ ▸ Luis Torres    DNI 7788…   0    Sin cta │ │ CCI 0021… [copiar]   │ │
│   luis@mail.com              [Crear cta]   │ │ Titular: Juan Pérez  │ │
│                                            │ └ creada 12/07/2026 ──┘ │
└────────────────────────────────────────────┴──────────────────────────┘
```

**Tabla principal (master):**

- Columnas: Cliente (nombre + correo en segunda línea), Documento (tipo + número de la identificación principal), Cuentas (badge con conteo + mini-chips `PE`/`BR` de los países donde tiene cuentas), Estado (`Con cuentas` / `Sin cuentas` en chip ámbar), Acciones.
- Fila clickeable → selecciona el usuario y carga el panel de detalle. La acción `Crear cuenta` también está en la fila para usuarios sin cuentas (CTA directo).
- Chips de filtro rápido con conteo: `Todos (N)` / `Con cuentas (N)` / `Sin cuentas (N)`. Buscador único por nombre, correo o documento (debounce 150 ms como hoy).
- Paginación client-side reutilizando el patrón actual.

**Panel de detalle (detail):**

- Header con nombre, correo, documento del cliente y botón `+ Crear cuenta` (siempre visible con permiso `bank_accounts.create`).
- Cuentas como **cards** agrupadas por país → flujo (`PERÚ · Destino`, `BRASIL · Origen`…), cada card con: banco + moneda, número de cuenta / CCI / clave PIX con **botón copiar al portapapeles** (los asesores copian estos datos constantemente), titular y tipo de titular, fecha de creación.
- Estado vacío explícito: «Este cliente aún no tiene cuentas registradas» + botón `Crear primera cuenta`.
- En pantallas angostas el panel se abre como drawer sobre la tabla.

## Fase 2 — Rediseño del flujo de creación (foco: que el asesor entienda todo)

El modal deja de heredar contexto de los filtros y se convierte en un **asistente de 3 pasos** con el cliente fijado y visible en todo momento.

```
┌ Nueva cuenta bancaria ────────────────────────────────────── ✕ ┐
│ Para: Juan Pérez García · juan@mail.com · DNI 41512345          │  ← banner fijo
│  ● 1 Tipo de cuenta ── ○ 2 Datos ── ○ 3 Confirmar               │  ← stepper
├─────────────────────────────────────────────────────────────────┤
│ PASO 1 · ¿Qué cuenta vas a registrar?                           │
│  País del banco     [ 🇵🇪 Perú ]  [ 🇧🇷 Brasil ]                 │
│  Uso de la cuenta   ( ) Origen  — cuenta desde la que el        │
│                          cliente envía el dinero                │
│                     (•) Destino — cuenta donde el cliente       │
│                          recibe el dinero                       │
│  Titular            (•) Persona natural  ( ) Persona jurídica   │
├─────────────────────────────────────────────────────────────────┤
│                                   [Cancelar]  [Continuar →]     │
└─────────────────────────────────────────────────────────────────┘
```

**Elementos permanentes:**

- **Banner del cliente** (nombre, correo, documento) fijo en el header del modal. No editable: elimina la asignación al cliente equivocado. Si el flujo se abre sin usuario (atajo desde transacciones), el paso 0 es el selector de cliente actual.
- **Stepper** de 3 pasos con navegación hacia atrás permitida; `Continuar` se habilita solo cuando el paso es válido.

**Paso 1 · Tipo de cuenta.** País, uso (origen/destino) y titular como opciones grandes con texto de ayuda en lenguaje del negocio (ver wireframe). Esto reemplaza el chip informativo heredado de filtros: el asesor decide el contexto dentro del flujo. Los valores por defecto se precargan desde los filtros activos de la lista, pero siempre son visibles y editables.

**Paso 2 · Datos de la cuenta.** Solo campos relevantes al país y titular elegidos:

| | Perú (PE) | Brasil (BR) |
|---|---|---|
| Banco | dropdown filtrado `country === 'pe'`, moneda visible | dropdown filtrado `country === 'br'`, moneda visible |
| Identificador* | N° de cuenta* + confirmación* | Tipo de clave PIX* (CPF / CNPJ / correo / celular / aleatoria) + clave PIX* + confirmación* |
| Interbancario | CCI + confirmación (opcional, 20 dígitos) | CPF del titular (11 dígitos) |
| Titular natural | Nombres, apellidos, DNI (8 dígitos) | Nombres, apellidos, CPF |
| Titular jurídica | Razón social, RUC (11 dígitos), rep. legal + doc. | Razão social, CNPJ, rep. legal + doc. |

- Validación **inline por campo** al perder foco: longitud esperada, dígitos, y check verde cuando la confirmación coincide. Pegar deshabilitado en los campos de confirmación (obliga a reteclear). El botón de continuar enfoca el primer campo inválido.
- Los campos fantasma actuales (`pix_key_type`, `pix_key_confirmation`, `cpf`, `cci_number_confirmation`) pasan a tener input real, renderizados según el país.
- La regla `requireAccountNumber = !lockedUserId` se reemplaza por una prop explícita `variant: 'accounts' | 'transaction'`: en `accounts` el identificador del país es obligatorio; en `transaction` se conserva el comportamiento laxo actual para no romper `transacciones_view.vue:5840`.

**Paso 3 · Confirmar.** Resumen legible antes de guardar:

> Vas a crear una cuenta **Destino** en **Perú** para **Juan Pérez García**:
> BCP (PEN) · N° cuenta 19112345678012 · CCI 00219111234567801254 · Titular: Juan Pérez (DNI 41512345)

Botón `Crear cuenta` (estado `Guardando…`). Tras crear: el modal se cierra, toast de éxito, el panel del usuario se actualiza con la cuenta nueva **resaltada** y el contador de la tabla sube; acción secundaria en el toast: `Crear otra cuenta para este cliente`.

## Fase 3 — Arquitectura Vue

```
cuentas_bancarias_view.vue          (orquestador)
├── BankAccountUsersFilters.vue     (búsqueda + chips con conteo)
├── BankAccountUsersTable.vue       (master)
├── UserBankAccountsPanel.vue       (detail: cards + copiar + vacío)
└── CuentaBancariaCreateFormModal.vue (asistente 3 pasos)
    ├── CuentaBancariaWizardStepContext.vue   (paso 1)
    ├── CuentaBancariaWizardStepDatos.vue     (paso 2, campos por país)
    └── CuentaBancariaWizardStepResumen.vue   (paso 3)
```

Composable `use_user_bank_accounts.ts`:

- Agrupa cuentas por `user_id` y calcula `{ user, accounts, countByCountry, hasAccounts }`.
- Aplica búsqueda (nombre, correo, documento) y filtros (todos / con / sin cuentas).
- Mantiene selección y paginación; evita mezclar cuentas al cambiar de usuario (patrón de secuencia ya usado en `loadBankAccountsForTransactionUser`).
- Tras `created`, actualiza el grupo del usuario sin recargar todo (upsert local + refresco selectivo).

Props tipadas y eventos; `<script setup lang="ts">` en todo. El wizard mantiene compatibilidad de API pública del modal (`v-model`, `locked-user-id`, `@created`) para no tocar el uso desde transacciones más allá de pasar `variant="transaction"`.

## Fase 4 — Datos

- Usuarios: `fetchClientUsers()` → `user/name-list/?role=client`. **Extender `UserOption`** con `identifications` (ya parseadas en `parseUserListItem`, hoy descartadas) para mostrar/buscar por documento.
- Cuentas: `GET transactions/bank-accounts/` **sin filtros** una sola vez al montar (en paralelo con usuarios y bancos) para agrupar y contar. Los filtros país/flujo del detalle se aplican client-side.
- Crear: `POST transactions/bank-accounts/` (sin cambios de contrato).
- **Validación previa obligatoria:** confirmar que `GET transactions/bank-accounts/` sin parámetros devuelve todas las cuentas (sin paginación ni límite implícito) y que `bank_country`/`account_flow` son opcionales. Si el backend pagina, se necesita soporte de paginación o un endpoint agregado de conteos antes de marcar usuarios como «sin cuentas».
- El alta desde transacciones se conserva como atajo; la administración principal vive en `/app/cuentas`.

## Fase 5 — Permisos

Sin cambios de esquema:

- `bank_accounts.view` — ver usuarios y sus cuentas.
- `bank_accounts.create` — botones `Crear cuenta` (tabla, panel y header).
- `bank_accounts.update` / `bank_accounts.delete` — reservados para edición/eliminación.

La vista **no** depende de `users.view`: la información mínima de usuarios llega por `user/name-list/` desde el módulo de cuentas, así un operador con permiso de cuentas no queda bloqueado.

## Fase 6 — Retiro de Mundial 2026

Eliminar `src/modules/world-cup/` completo y limpiar referencias verificadas:

- [router/index.ts:18](../../src/interface/router/index.ts) (candidato de redirección por permisos), líneas 40–43 (ruta `/app/mundial-2026`) y línea 142 (redirect `/mundial-2026`).
- [app_layout.vue:50](../../src/interface/layout/app_layout.vue) (ítem del menú lateral).
- [permissions.ts:5-10](../../src/modules/auth/domain/models/permissions.ts) (grupo `world_cup`) y líneas 181–183 (asignaciones predeterminadas).
- `FEATURE_MAP.md` líneas 38 y 62 (inventario del módulo y matriz de permisos).
- Referencias pendientes en `docs/plans/` activos.

Los documentos históricos de auditoría se conservan añadiendo la nota «módulo retirado el 2026-07-21». El endpoint Django `world-cup/*` se elimina en el repo del backend (`com_brasper_api`), no aquí.

## Fase 7 — Pruebas

Composable y componentes (`vitest`, `@pinia/testing`):

- Agrupa varias cuentas bajo el usuario correcto; usuarios con cero cuentas aparecen con contador 0.
- No mezcla cuentas al cambiar rápido de usuario seleccionado (carrera de requests).
- Búsqueda por nombre, correo y documento (incluida identificación secundaria).
- Filtros con/sin cuentas y conteos de los chips.
- Wizard: `Continuar` bloqueado con paso inválido; campos PE vs BR correctos por país; bancos filtrados por país; confirmaciones que no coinciden bloquean; `variant="accounts"` exige identificador y `variant="transaction"` no.
- Crear envía el `user_id` bloqueado; el contador y el panel se actualizan tras crear.
- Acciones ocultas sin `bank_accounts.create`.
- Sin restos de Mundial: imports, rutas, permisos, menú.

Validación final:

```bash
npm run check
```

```bash
rg -n -i "world.?cup|mundial" src FEATURE_MAP.md docs/plans
```

## Criterios de aceptación

1. Todos los clientes aparecen, incluso sin cuentas, con contador correcto y estado visible.
2. Las cuentas de un cliente se consultan sin pasar por transacciones, con copiar-al-portapapeles en número/CCI/PIX.
3. Al crear, el asesor ve siempre el cliente fijado, elige país/uso/titular explícitamente y solo ve los campos del país elegido, con validación inline.
4. Es imposible guardar una cuenta sin identificador (N° cuenta en PE, clave PIX en BR) desde `/app/cuentas`.
5. El paso de confirmación resume la cuenta en lenguaje natural antes de guardar.
6. La cuenta nueva aparece resaltada de inmediato en el panel y el contador.
7. La interfaz respeta `bank_accounts.*`; sin dependencia de `users.view`.
8. Mundial 2026 desaparece de menú, rutas, permisos y código activo.
9. `npm run check` verde y `rg` de Mundial sin resultados en código activo.

## Orden de implementación sugerido

1. Fase 6 (Mundial) — independiente y de bajo riesgo, despeja el terreno.
2. Fase 4 validación del endpoint sin filtros (bloqueante para el resto).
3. Fases 1+3 (vista master–detail + composable) con el modal actual.
4. Fase 2 (wizard) reutilizando el modal, con `variant` para transacciones.
5. Fase 7 (pruebas) acompaña cada fase; criterios de aceptación al cierre.
