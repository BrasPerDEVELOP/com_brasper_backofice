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

Contabilidad (2026-09-12): botón Exportar Excel con todas las páginas del filtro vigente mediante `GET /transactions/accounting` (`accounting.view`). Incluye documentos, fechas, importes numéricos y desglose contable, con monedas separadas. No requiere migración.

Etiquetas (2026-09-12): `counts_as_new_client` admite varias etiquetas marcadas a la vez. El panel cuenta cada transacción una sola vez si tiene al menos una de ellas; las etiquetas borradas no cuentan. No requiere migración.

Filtro de etiquetas en listados (2026-09-21): Ventas (`GET /transactions`) y Contabilidad (`GET /transactions/accounting`) aceptan `tag_ids` repetido, mismo OR que `metrics/overview`. El envío entra si tiene al menos una de las etiquetas. El catálogo sale de `GET /transactions/tags`.

Ampliación 2026-09-11: campanita (`notifications.view`) y avisos (`notifications.create`) usan `/notifications`, `/notifications/staff`, `/notifications/avisos` y rutas de lectura. Transacciones envía `observaciones` y `mentioned_user_ids`. Usuarios incorpora Historial (`users.view` + `transactions.view`) y Acceso (`users.update` + `roles.permissions.update`, sin edición propia); los deltas se guardan mediante PUT `/user`. Login y `/auth/me` usan exclusivamente los permisos efectivos recibidos del API, salvo bypass admin.

| Módulo | Ruta Vue | Permiso view | Store Pinia | Adapter principal | API path (Domain.apiPath) | Capas |
|--------|----------|--------------|-------------|-------------------|---------------------------|-------|
| auth / login | `/` | público | `useAuthStore` | `auth_api_adapter` | `auth/login` | Completo |
| dashboard / metrics | `/app/dashboard` (`/app/metricas` redirige conservando query) | `dashboard.view` o `metrics.view` | `use_metrics_store` | `metrics_api_adapter` | `env.metricsOverviewPath` (`metrics/overview`) | Completo; métricas con `metrics.view`, panel legado con solo `dashboard.view` |
| transacciones | `/app/transacciones` | `transactions.view` | `use_transactions_store` | `transactions_api_adapter` | `transactions` | Completo — **god view** |
| contabilidad | `/app/contabilidad` | `accounting.view` | — | — | — | Solo presentation ⚠️ |
| calculator | `/app/calculator` | `calculator.view` | `useCalculatorStore` | `calculator_api_adapter` | `coin/{path}` | Completo |
| cupones | `/app/cupones` | `coupons.view` | `use_cupones_store` | `cupones_api_adapter` | `transactions/coupons` | Completo |
| comisiones | `/app/comisiones` | `commissions.view` | `use_comisiones_store` | `comisiones_api_adapter` | `coin` | Completo |
| auth / usuarios + cuentas | `/app/usuarios` | `users.view` o `bank_accounts.view` | auth store + `use_cuentas_bancarias_store` | `users_management_api_adapter` + `cuentas_bancarias_api_adapter` | `user` + `transactions/bank-accounts` | Completo — workspace unificado; `/app/cuentas` redirige aquí |
| cuentas Brasper | `/app/cuentas-brasper` | `company_bank_accounts.view` | `use_cuentas_bancarias_store` (catálogo) | `banks_api_adapter` | `transactions/banks` | Completo — CRUD corporativo de razón social, banco, moneda, país y cuenta |
| tasas | `/app/tasas` | `rates.view` | `use_tasas_store` | `tasas_api_adapter` | `coin` | Completo |
| home-banner | `/app/home-banner` | `home_banner.view` | — | `home_banner_api_adapter` | (ver adapter) | Sin application ⚠️ |
| blog | `/app/blog` | `blog.view` | — | `blog_api_adapter` | `blog` | Sin application ⚠️ |
| auth / roles | `/app/roles-permisos` | `roles.permissions.view` | auth store | `role_permissions_api_adapter` | `roles/permissions` | Completo |
| auth / perfil | `/app/perfil` | `profile.view` | auth store | `auth_api_adapter` | `env.authProfilePath` | Completo |
| auditoría | `/app/auditoria` | `audit.view` | `useAuditStore` | `audit_api_adapter` | `audit/events` + `audit/logins` | Completo; solo lectura |

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
| company_bank_accounts | `.create` | `.update` | `.delete` | cuentas operativas Brasper |
| blog | `.create` | `.update` | `.delete` | |
| users | `.create` | `.update` | `.delete` | `.reset_password` |
| home_banner | — | `.update` | — | |
| integrations | `.create` | `.update` | `.delete` | administración API |
| contact_forms | — | — | — | `.view` para datos recibidos |

**Gate UI (Fase B ✅):** botones mutables gateados con `auth.hasPermission('module.action')`
en transacciones, cupones, comisiones, tasas, cuentas, blog, banner, usuarios (+ guards
defensivos en los handlers).

---

## Quirks API (documentados)

| Quirk | Dónde | Nota |
|-------|-------|------|
| PUT transaction `id` en body | `transactions_api_adapter.ts` | No en URL path |
| FormData POST transaction | `transactions_api_adapter.ts` + `apiClient` | El interceptor elimina `Content-Type` para que axios genere el boundary |
| Field aliases | adapters | `resultado_comision` ↔ `commission_result` |
| Razón social exacta | `social_reason_bank_id` | FK independiente; `bank_id` sigue perteneciendo a la cuenta destino |
| Múltiples cuentas destino | `destinations[]` | Lista cuenta+monto; `bank_account_destination_id` conserva el primer destino por compatibilidad |
| Múltiples identificaciones de usuario | `identifications[]` | Lista tipo+número+principal; `document_type` y `document_number` conservan el documento principal por compatibilidad |
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
| MediaViewerDialog | `interface/widgets/MediaViewerDialog.vue` | Visor autenticado de imágenes/PDF en transacciones y contabilidad |

---

## Plan de mejoras

Ver [docs/plans/00-ROADMAP.md](docs/plans/00-ROADMAP.md).

Avisos: destinatarios por usuarios, roles o todo el equipo; editor visual/HTML con formato seguro. Observaciones al final del paso Datos. La pestaña de acceso individual se muestra como Permisos.

Marketing (2026-10-19): `/app/marketing`, permisos `marketing.view/create/send`, API `marketing/configuration`, `marketing/clients`, `marketing/campaigns` y subrutas `{id}/test`, `{id}/send`, `{id}/recipients`. Baja pública firmada en `marketing/unsubscribe`. Importación local Excel/CSV y selección paginada de clientes; credenciales solo en backend.

Plantillas de marketing (2026-10-19): campañas persisten `template_key`; diseño por defecto `brasper_peru_pt_v1` (portugués) con alternativa de mensaje sencillo. `GET marketing/templates`, `POST marketing/preview`. Vista previa aislada para escritorio/móvil y mismo renderer para prueba y envío masivo; migración API 089.

Marketing: selector de público Brasil/portugués y Perú/español; textos predeterminados localizados y preservación de textos personalizados.

Marketing: editor y audiencia en columna izquierda, vista previa a la derecha e historial debajo; controles adaptables a móvil.

Marketing: tarjetas de público Brasil/Perú, contador de asunto y audiencia, estado de actualización de vista previa y tarjetas de resultados por campaña.

Actualizaciones: HTML NetworkFirst, service worker comprobado al volver al panel y cada minuto; aviso de nueva versión con recarga voluntaria para preservar formularios. Ver docs/ops/CACHE-UPDATES.md.
