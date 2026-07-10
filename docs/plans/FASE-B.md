# Fase B — Auth, permisos UI, adopción de widgets

**Estado:** ✅ Completada (2026-07-10)  
**PR sugerido:** `feat/fase-b-auth-widgets`  
**Tiempo estimado:** 2–4 días (1 dev)  
**Sin:** cambios visuales, features nuevas

> **Resumen de cierre:** B1 (router bloquea `client`) · B2 (creds dev solo DEV) ·
> B3 (`parse_user` canónico + tests) · B4 (`hasPermission` en 8 vistas + guards) ·
> B5 (0 `window.confirm`; `ConfirmDialog` en 5 módulos) · B6 (PageHeader/EmptyState/
> AppSpinner adoptados sin cambio visual) · B7 (modales divididos shell+form) ·
> B8 (stubs eliminados). `npm run check` verde.

## Objetivo

Cerrar huecos de seguridad/UX detectados en auditoría: rol `client` en router, botones sin `hasPermission`, `window.confirm` disperso, parsers duplicados, módulos stub.

---

## B1 — Router: bloquear `client` en todo el backoffice

**Archivos:**
- `src/interface/router/index.ts`
- `src/modules/auth/presentation/controllers/use_auth_store_controller.ts`

**Tareas:**

- [ ] Tras `restoreUser()` en `beforeEach`, llamar `validateBackofficeAccess()` (o equivalente)
- [ ] Si rol es `client` → `logout()` + redirect `/`
- [ ] Test: `src/modules/auth/domain/permissions.test.ts` — client no tiene permisos de backoffice mutables

**Criterio de aceptación:** sesión restaurada desde `localStorage` con rol `client` no entra a `/app/*`.

---

## B2 — Credenciales dev solo en desarrollo

**Archivos:**
- `src/modules/auth/presentation/bodies/login_view.vue`
- `src/interface/config/env.ts`

**Tareas:**

- [ ] Prefill `VITE_USERNAME` / `VITE_PASSWORD` solo si `import.meta.env.DEV`
- [ ] Comentario en `env.ts` y README

---

## B3 — Parser de usuario canónico

**Archivos a crear:**
- `src/modules/auth/infrastructure/parse_user.ts`

**Archivos a refactorizar:**
- `src/modules/auth/infrastructure/adapters/auth_api_adapter.ts`
- `src/modules/auth/infrastructure/adapters/users_management_api_adapter.ts`
- `src/modules/cuentas-bancarias/infrastructure/adapters/users_api_adapter.ts` (si aplica)

**Tareas:**

- [ ] Una función `parseUser(raw: unknown): AuthUser | null`
- [ ] Adapters importan el parser; eliminar duplicados
- [ ] Test: `parse_user.test.ts` con fixtures JSON

---

## B4 — `hasPermission` en botones mutables

Gatear **create / update / delete** con `useAuthStore().hasPermission(...)`.

| Vista | Permisos a gatear |
|-------|-------------------|
| `transacciones_view.vue` | `transactions.create`, `.update`, `.delete` |
| `cupones_view.vue` | `coupons.create`, `.update`, `.delete` |
| `comisiones_view.vue` | `commissions.create`, `.update`, `.delete` |
| `tasas_view.vue` | `rates.create`, `.update`, `.delete` |
| `cuentas_bancarias_view.vue` | `bank_accounts.create`, `.update`, `.delete` |
| `blog_view.vue` | `blog.create`, `.update`, `.delete` |
| `banner_view.vue` | `home_banner.update` |
| `usuarios_view.vue` | ya parcial — completar |

**Patrón (sin cambiar estilos):**

```vue
<Button v-if="auth.hasPermission('coupons.create')" @click="openCreate">
```

**Tareas:**

- [ ] Composable opcional `usePermissionGate()` en `src/modules/auth/presentation/composables/`
- [ ] Cada vista lista arriba actualizada
- [ ] Test router o unit: sales sin `coupons.delete` no renderiza botón (opcional component test)

---

## B5 — Reemplazar `window.confirm` por `ConfirmDialog`

**Buscar:** `window.confirm`, `confirm(` en `src/modules/`

| Archivo | Líneas ref. audit |
|---------|-------------------|
| `transacciones_view.vue` | ~341, ~1780 |
| `usuarios_view.vue` | ~211 |
| `blog_view.vue` | ~505 |
| `cupones_view.vue` | ~31 |
| `comisiones_view.vue` | ~96 |

**Tareas:**

- [ ] Import `ConfirmDialog` desde `@interface/widgets`
- [ ] Mismo texto y flujo; solo cambia el componente
- [ ] `npm run check` verde

---

## B6 — Adoptar widgets en vistas piloto (2–3)

**Piloto recomendado:** `cupones_view.vue`, `comisiones_view.vue`, `tasas_view.vue`

**Tareas:**

- [ ] `PageHeader` en lugar de `<h1>` manual
- [ ] `EmptyState` cuando lista vacía
- [ ] `AppSpinner` en loading
- [ ] **Mismas clases Tailwind** que ya tenía la vista

---

## B7 — Split modales compartidos >400 líneas

**Archivos:**
- `src/interface/components/BancoCrudModal.vue` (582 líneas)
- `src/interface/components/CuentaBancariaCreateFormModal.vue` (538 líneas)

**Estructura objetivo:**

```
BancoCrudModal.vue          → shell + open/close (~80 líneas)
BancoCrudForm.vue           → campos + validación
CuentaBancariaCreateFormModal.vue → shell
CuentaBancariaCreateForm.vue      → campos
```

**Tareas:**

- [ ] Extraer form body sin cambiar markup/classes
- [ ] Exportar desde `interface/components/` o subcarpeta

---

## B8 — Eliminar módulos stub

**Eliminar carpetas:**
- `src/modules/accounts/`
- `src/modules/transactions/`
- `src/modules/user/`

**Tareas:**

- [ ] Grep que no haya imports a esos paths
- [ ] Actualizar `CLAUDE.md` / `FEATURE_MAP.md`

---

## B9 — Documentación

- [ ] Actualizar `CLAUDE.md` — excepciones de capas (dashboard, contabilidad, world-cup)
- [ ] Marcar Fase B completada en `00-ROADMAP.md`

---

## Checklist pre-merge Fase B

```bash
npm run check
npm run build
```

- [ ] Router bloquea `client`
- [ ] ≥5 vistas con `hasPermission` en botones
- [ ] 0 `window.confirm` en módulos críticos
- [ ] `parse_user.ts` único
- [ ] Stubs eliminados
- [ ] Cero cambio visual perceptible

## Prompt Cursor

Ver [docs/PROMPT-FASES.md](../PROMPT-FASES.md#fase-b).
