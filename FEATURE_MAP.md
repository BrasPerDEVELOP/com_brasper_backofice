# Brasper Backoffice — FEATURE_MAP

> **Contrato front ↔ API Django.** Leer antes de tocar un módulo.  
> Actualizar este archivo cuando agregues rutas, permisos o endpoints.

## Arquitectura

```
Vue View (*_view.vue)
  → Pinia Store (use_*_store_controller.ts)
    → Use Case (application/use_cases/)
      → Repository interface
        → API Adapter (infrastructure/adapters/)
          → apiClient / fetch → Django API
```

**Permisos:** `module.action` en `src/modules/auth/domain/models/permissions.ts`  
**Router:** `src/interface/router/index.ts` — `meta.permission` = permiso `.view` mínimo

---

## Mapa de módulos

| Módulo | Ruta Vue | Permiso view | Store Pinia | Adapter principal | API path (Domain.apiPath) | Capas |
|--------|----------|--------------|-------------|-------------------|---------------------------|-------|
| auth / login | `/` | público | `useAuthStore` | `auth_api_adapter` | `auth/login/` | Completo |
| dashboard | `/app/dashboard` | `dashboard.view` | — (multi-store) | varios | — | Solo presentation ⚠️ |
| metrics | `/app/metricas` | `metrics.view` | `use_metrics_store` | `metrics_api_adapter` | `env.metricsWeeklyPath` | Completo |
| transacciones | `/app/transacciones` | `transactions.view` | `use_transactions_store` | `transactions_api_adapter` | `transactions/` | Completo — **god view** |
| contabilidad | `/app/contabilidad` | `accounting.view` | — | — | — | Solo presentation ⚠️ |
| calculator | `/app/calculator` | `calculator.view` | `useCalculatorStore` | `calculator_api_adapter` | `coin/{path}` | Completo |
| cupones | `/app/cupones` | `coupons.view` | `use_cupones_store` | `cupones_api_adapter` | `transactions/coupons/` | Completo |
| comisiones | `/app/comisiones` | `commissions.view` | `use_comisiones_store` | `comisiones_api_adapter` | `coin/` | Completo |
| cuentas-bancarias | `/app/cuentas` | `bank_accounts.view` | `use_cuentas_bancarias_store` | `cuentas_bancarias_api_adapter` | `transactions/bank-accounts/` | Completo |
| tasas | `/app/tasas` | `rates.view` | `use_tasas_store` | `tasas_api_adapter` | `coin/` | Completo |
| home-banner | `/app/home-banner` | `home_banner.view` | — | `home_banner_api_adapter` | (ver adapter) | Sin application ⚠️ |
| blog | `/app/blog` | `blog.view` | — | `blog_api_adapter` | `blog/` | Sin application ⚠️ |
| world-cup | `/app/mundial-2026` | `world_cup.view` | — | `world_cup_api.ts` | (ver adapter) | Infra plana ⚠️ |
| auth / usuarios | `/app/usuarios` | `users.view` | auth store | `users_management_api_adapter` | `user/` | Completo |
| auth / roles | `/app/roles-permisos` | `roles.permissions.view` | auth store | `role_permissions_api_adapter` | `roles/permissions/` | Completo |
| auth / perfil | `/app/perfil` | `profile.view` | auth store | `auth_api_adapter` | `env.authProfilePath` | Completo |

### Módulos stub — ELIMINADOS (Fase B ✅)

`modules/accounts/`, `modules/transactions/`, `modules/user/` fueron eliminados.
No confundir con los reales `transacciones`, `cuentas-bancarias`, `auth/usuarios`.

---

## Permisos mutables por módulo

| Módulo | create | update | delete | otros |
|--------|--------|--------|--------|-------|
| transactions | `.create` | `.update` | `.delete` | import |
| coupons | `.create` | `.update` | `.delete` | |
| commissions | `.create` | `.update` | `.delete` | |
| rates | `.create` | `.update` | `.delete` | |
| bank_accounts | `.create` | `.update` | `.delete` | |
| blog | `.create` | `.update` | `.delete` | |
| users | `.create` | `.update` | `.delete` | `.reset_password` |
| home_banner | — | `.update` | — | |
| world_cup | — | `.manage` | — | `.approve` |

**Gate UI (Fase B ✅):** botones mutables gateados con `auth.hasPermission('module.action')`
en transacciones, cupones, comisiones, tasas, cuentas, blog, banner, usuarios (+ guards
defensivos en los handlers).

---

## Quirks API (documentados)

| Quirk | Dónde | Nota |
|-------|-------|------|
| PUT transaction `id` en body | `transactions_api_adapter.ts` | No en URL path |
| FormData POST transaction | adapter + `fetch` | No axios (boundary) |
| Field aliases | adapters | `resultado_comision` ↔ `commission_result` |
| Cloudinary blog | `blog_view.vue` | Mover a adapter + env (Fase C blog) |

---

## Widgets compartidos

| Widget | Ruta | Fase |
|--------|------|------|
| PageHeader | `interface/widgets/PageHeader.vue` | A ✅ (adoptado en comisiones) |
| EmptyState | `interface/widgets/EmptyState.vue` | A ✅ (adoptado en blog) |
| AppSpinner | `interface/widgets/AppSpinner.vue` | A ✅ (adoptado en blog) |
| ConfirmDialog | `interface/widgets/ConfirmDialog.vue` | A ✅ (adoptado en 5 módulos) |
| DataTable | `interface/widgets/DataTable.vue` | C ✅ (implementado; adopción en transacciones pendiente) |

---

## Plan de mejoras

Ver [docs/plans/00-ROADMAP.md](docs/plans/00-ROADMAP.md).
