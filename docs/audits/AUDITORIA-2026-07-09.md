# Auditoría Brasper Backoffice — 2026-07-09

**Proyecto:** `com_brasper_backofice`  
**Skills aplicadas:** `brasper-backoffice-audit`, `thermo-nuclear-code-quality-review`  
**Alcance:** Fase 1 — solo auditoría (sin implementación)  
**Regla dura:** no evaluar ni proponer cambios de diseño visual (colores Brasper, Tailwind, tipografía, layout).

---

## 1. Resumen ejecutivo

1. **`transacciones_view.vue` es un god file CRITICAL** (5621 líneas; script ~1–2730 + template ~2732–5621). Importa 5 stores ajenos, ≥100 funciones y concentra wizard, tabla, preview e import. Thermo-nuclear: no se debe agregar más lógica aquí sin split.
2. **Tooling incompleto vs disciplina Stemis (4 capas):** no hay ESLint/Prettier, no hay scripts `typecheck`/`lint`/`test`/`check`, no hay CI (`.github` / `.gitea`), no hay `README.md` raíz. Sí hay Vitest (7 tests) y `dist/` gitignored.
3. **Lockfile duplicado:** coexisten `package-lock.json` y `pnpm-lock.yaml` → riesgo de installs divergentes entre devs/CI.
4. **Auth parcial:** `client` se bloquea en login (`validateBackofficeAccess`), pero el router solo valida token + `meta.permission`; `restoreUser()` no revalida rol. La mayoría de vistas mutables no ocultan botones con `hasPermission`.
5. **UI compartida vacía:** `interface/widgets/` es placeholder (`export {}`). Patrones repetidos (`window.confirm`, headers, spinners) viven inline en cada view. Modales compartidos `BancoCrudModal` (582) y `CuentaBancariaCreateFormModal` (538) superan el umbral de 400 líneas.

---

## 2. Hallazgos por severidad

### CRITICAL

| # | Archivo:línea | Problema | Fix sugerido |
|---|---------------|----------|--------------|
| C1 | `src/modules/transacciones/presentation/bodies/transacciones_view.vue` (5621 líneas; script `1:2730`, template `2732:5621`) | God file >3000. Orquesta filtros, tabla, menú acciones, preview, wizard create/edit, import. Imports de 6 stores (`13:18`, `62:67`). `window.confirm` en `341` y `1780`. Sin gates `hasPermission` para create/update/delete. | Plan de split obligatorio (Fase C): FiltersBar, TransactionsTable, PreviewModal, CreateEditWizard, ImportModals + composable facade multi-store. Congelar adiciones al archivo. |
| C2 | Repo raíz — ausencia de `.github/workflows/` y `.gitea/workflows/` | Sin Capa 2 Stemis (CI en PR). Equipo >1 dev sin red de seguridad automatizada. | Añadir workflow: `npm ci` → typecheck → lint → test → build. |
| C3 | `package-lock.json` + `pnpm-lock.yaml` (ambos presentes) | Dos gestores de deps → builds no reproducibles. | Elegir uno (recomendado: npm + `package-lock.json` si el equipo usa npm) y eliminar el otro. |

### HIGH

| # | Archivo:línea | Problema | Fix sugerido |
|---|---------------|----------|--------------|
| H1 | `use_auth_store_controller.ts:131-141` (validate); `login_view.vue:231-233` (solo login); `router/index.ts:169-184` (sin check client); `restoreUser` `186:197` | Rol `client` bloqueado solo en login. Sesión restaurada desde `localStorage` puede pasar `hasPermission` porque defaults de client incluyen `dashboard.view` (`permissions.ts:140-146`). | Llamar `validateBackofficeAccess()` en `router.beforeEach` tras `restoreUser()`; si falla → logout + redirect `/`. |
| H2 | Bodies mutables sin `hasPermission` UI | Solo `usuarios_view.vue:42-45`, `profile_view.vue:290-291`, `roles_permissions_view.vue:66`, parcial `dashboard_view.vue:205`. **Cero** matches en transacciones/cupones/comisiones/tasas/cuentas/blog/banner. Router solo exige `.view` (ej. `router/index.ts:65`). | Gatear botones create/update/delete con permisos `module.action`. |
| H3 | `transacciones_view.vue:13-67` (5 stores ajenos); `dashboard_view.vue:3-26` (6 stores/adapters ajenos) | Views importan >2 stores ajenos sin composable intermedio (checklist A). | Extraer `useTransactionFormContext` / `useDashboardSummary` que encapsulen orquestación. |
| H4 | `blog_view.vue` (1098 líneas); Cloudinary hardcode `243:244`, `260` | View >1000 líneas; URL Cloudinary y upload en la view (capa incorrecta). | Extraer list/editor; mover upload a adapter/service + env. |
| H5 | `BancoCrudModal.vue` (582); `CuentaBancariaCreateFormModal.vue` (538) | Modales compartidos >400 líneas (checklist C). | Dividir shell modal + form body. |
| H6 | Stubs: `src/modules/accounts/`, `transactions/`, `user/` (solo scaffolding / `.gitkeep`) | Confusión con módulos reales (`transacciones`, auth/usuarios, `cuentas-bancarias`). | Eliminar stubs o documentar “do not use” y borrar del árbol. |
| H7 | `login_view.vue:189-190`, `222-224`; `env.ts:87-95` | `VITE_USERNAME` / `VITE_PASSWORD` se leen siempre y se prellenan en login; si están en build de prod, quedan en el bundle. | Prefill solo con `import.meta.env.DEV`. |
| H8 | `package.json:6-9` | Scripts solo `dev` / `build` / `preview`. No hay `typecheck`, `lint`, `test`, `check`. Capa 1 Stemis imposible de estandarizar. | Añadir scripts (Fase A). |

### MEDIUM

| # | Archivo:línea | Problema | Fix sugerido |
|---|---------------|----------|--------------|
| M1 | `interface/widgets/index.ts:1-2` (`export {}`); `widgets/README.md` placeholder | Capa widgets vacía; patrones repetidos en cada view. | Implementar `PageHeader`, `EmptyState`, `AppSpinner`, `ConfirmDialog` (misma estética actual). |
| M2 | Sin ESLint / Prettier (0 configs en repo) | Sin convención automática de estilo/calidad. | ESLint flat config Vue+TS + Prettier básico. |
| M3 | Sin `README.md` raíz | Onboarding frágil (sí hay `CLAUDE.md` / `AGENTS.md`). | README mínimo: setup, scripts, arquitectura, link a docs. |
| M4 | Solo 7 archivos `*.test.ts` | Cobertura parcial: calculator, transaction_domain, home-banner adapter, metrics charts. Faltan tests de `permissions`, `auth_api_adapter`, `transactions_api_adapter` parse/PUT quirk. | Ampliar suite (Capa 3 gate). |
| M5 | `transactions_api_adapter.ts` (609 líneas); aliases `176:178`, `290:291`; PUT id-in-body `530:533`; FormData+fetch `428:493` | Adapter >500; normalización correcta de capa pero densa. | Extraer `parse_transaction.ts` / `transaction_form_payload.ts`. Documentar quirk PUT en un solo comentario canónico (ya está en `530:531`). |
| M6 | `parseUser` duplicado: `auth_api_adapter.ts:25`, `users_management_api_adapter.ts:24`; + `users_api_adapter.ts:13` (UserOption) | Tres parsers de usuario. | Unificar parser canónico en auth domain/infra. |
| M7 | Capas saltadas: `dashboard/` y `contabilidad/` solo presentation; `blog/` y `home-banner/` sin `application/`; `world-cup/` infra plana | Documentado parcialmente en `memory/project_structure.md`; no en CLAUDE como excepciones formales. | Documentar excepciones o añadir capa application delgada. |
| M8 | `Coupon` homónimo: `calculator/domain/models/coupon.ts:1-7` vs `cupones/domain/models/coupon.ts:1-15` | Colisión de nombre de tipo; shapes distintas. | Renombrar calc a `AppliedCoupon` / `CalculatorCoupon`. |
| M9 | `window.confirm` / `confirm()` en: transacciones `341`, `1780`; `usuarios_view.vue:211`; `blog_view.vue:505`; `cupones_view.vue:31`; `comisiones_view.vue:96` | UX inconsistente; sin ConfirmDialog compartido. | Widget `ConfirmDialog` (Fase A/B). |
| M10 | `dashboard_view.vue` (796), `contabilidad_view.vue` (809) | Cerca del umbral 1000; acoplamiento a stores ajenos. | Extraer KPIs/tablas a components; no crecer más. |

### LOW

| # | Archivo:línea | Problema | Fix sugerido |
|---|---------------|----------|--------------|
| L1 | `tasas_demo_compact.vue` (snake_case componente) | Inconsistencia PascalCase Vue. | Renombrar cuando se toque el módulo. |
| L2 | Placeholders vacíos: `interface/presentation/index.ts`, `auth/presentation/widgets/index.ts` | Ruido estructural. | Eliminar o poblar. |
| L3 | Token JWT solo en `localStorage` (`use_auth_store_controller.ts:92`, `110-111`) | Riesgo XSS clásico; documentado en CLAUDE. | Documentar en README; evaluar refresh/httpOnly si backend lo soporta (fuera de alcance front solo). |
| L4 | Adapters transacciones/auth: 0× `any` / `@ts-ignore` | Positivo — usan `unknown`. | Mantener; tipar parsers progresivamente. |
| L5 | `format_api_error.ts` existe y se usa en varios adapters | Buen patrón central. | Extender uso a stores/views que aún formatean a mano. |
| L6 | `dist/` en `.gitignore:3` | Correcto; no trackeado. | Sin acción. |

---

## 3. Thermo-nuclear — god files y spaghetti

### Umbrales skill

| Umbral | Archivos |
|--------|----------|
| **>3000 CRITICAL** | `transacciones_view.vue` **5621** |
| **>1000 HIGH** | `blog_view.vue` **1098** |
| **>500 adapter** | `transactions_api_adapter.ts` **609** |
| **>400 modal** | `BancoCrudModal.vue` **582**, `CuentaBancariaCreateFormModal.vue` **538** |
| Cerca de 1000 | `contabilidad_view.vue` 809, `dashboard_view.vue` 796, `usuarios_view.vue` 721 |

### Code-judo prioritario (sin cambiar comportamiento)

1. **`transacciones_view.vue` → orquestador <300 líneas**  
   Extraer regiones ya identificables: header/actions (~2734+), filters (~2809+), table (~2911+), action menu (~3245+), preview (~3326+), wizard (~3731+), import (~5426+). Mover resolución de cuentas/monedas/asesor/calculadora a composables puros.
2. **Facade multi-store** en lugar de 5–6 `useXStore()` en la view — elimina acoplamiento y facilita tests.
3. **Confirm nativo → ConfirmDialog** — borra ramas `if (!confirm(...)) return` dispersas.
4. **Mapper extract del adapter** — el archivo deja de ser “todo el contrato Django en un solo TS”.
5. **No crecer `blog_view` / dashboard / contabilidad** hasta extraer; cualquier PR que los empuje >1000 sin split = bloqueo thermo-nuclear.

### Spaghetti patterns detectados

- Lógica de negocio de status/labels en la view (`getStatusLabel` / badges ~2232+ en transacciones).
- View llama adapter auth directo (`fetchUsers` en `transacciones_view.vue:60`, `dashboard_view.vue:10`) saltando store/use-case.
- Dashboard instancia adapters en la view (`BlogApiAdapter`, `HomeBannerApiAdapter`, `TransactionsApiAdapter` en `dashboard_view.vue:11-17`, `25-26`).
- Condicionales de descuento especial + confirm embebidos en flujo wizard (`341+`).

---

## 4. Comparación vs checklist brasper-backoffice-audit

### A. Arquitectura

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Módulos activos domain→use_cases→adapters→store→view | Parcial | Cumplen: auth, transacciones, tasas, comisiones, cupones, cuentas-bancarias, calculator, metrics. Fallan capas: blog/home-banner (sin application), dashboard/contabilidad (solo presentation), world-cup (infra plana). |
| Stubs eliminar o implementar | Fail | `accounts/`, `transactions/`, `user/` |
| world-cup / dashboard / contabilidad documentados | Parcial | `memory/project_structure.md`; falta formalizar en CLAUDE |
| Views ≤2 stores ajenos | Fail | transacciones (5), dashboard (6) |
| URLs vía `Domain.apiPath()` | Pass con excepciones | Adapters OK; blog Cloudinary hardcode `blog_view.vue:243-260` |

### B. God files

| Ítem | Estado |
|------|--------|
| >3000 plan split | **Fail CRITICAL** — transacciones 5621 |
| >1000 no agregar | **Fail** — blog 1098 |
| Adapter >500 | **Warn** — transactions_api_adapter 609 |

### C. UI compartida

| Ítem | Estado |
|------|--------|
| widgets con exports reales | **Fail** — `export {}` |
| PageHeader / EmptyState / ConfirmDialog / AppSpinner | **Fail** — no existen |
| Modales >400 dividir | **Fail** — Banco + CuentaBancaria |
| No tocar paleta brasper | Pass (auditoría no toca) |

### D. Auth y permisos

| Ítem | Estado |
|------|--------|
| Token localStorage documentado | Pass (CLAUDE) + riesgo XSS LOW |
| hasPermission en router Y UI | Parcial — router OK; UI solo auth/dashboard |
| client bloqueado | Parcial — login sí; router/restore no |
| VITE_USERNAME/PASSWORD no en prod | Riesgo — no hay guard `DEV` |
| parseUser unificado | Fail — 2–3 parsers |

### E. API / adapters

| Ítem | Estado |
|------|--------|
| PUT id en body documentado | Pass — `transactions_api_adapter.ts:530-533` |
| FormData usa fetch | Pass — `493` |
| Aliases en adapter no views | Pass |
| Errores con helper central | Parcial — `format_api_error.ts` usado en varios, no todos |

### F. Tooling y higiene

| Ítem | Estado |
|------|--------|
| Un solo lockfile | **Fail** — npm + pnpm |
| Scripts test/typecheck/lint/check | **Fail** |
| CI workflow | **Fail** |
| dist/ no commiteado | Pass |
| README + AGENTS | Parcial — AGENTS sí, README no |

### G. Tests

| Ítem | Estado |
|------|--------|
| Dominio transaction_domain / permissions | Parcial — domain sí; permissions no |
| Adapters mapeo JSON→model | Parcial — home-banner sí; transactions/auth no |
| Cobertura mínima permisos/transacciones/calculator | Parcial — calculator + domain OK |

**Scorecard global:** A parcial · B fail · C fail · D parcial · E pass-con-deuda · F fail · G parcial.

---

## 5. Las 4 capas Stemis — estado actual

| Capa | Esperado | Estado hoy |
|------|----------|------------|
| 1 Local | typecheck + lint + vitest (pre-push) | ✅ `npm run check` (Fase A). Falta hook pre-push (Fase D) |
| 2 CI PR | npm ci + typecheck + lint + test + build | ✅ `.github/workflows/ci.yml` (Fase A) |
| 3 Gate merge | tests adapters + permisos + E2E + no god files nuevos | **Ausente** (tests parciales) |
| 4 Post-deploy | smoke API + login + permisos | **Ausente** (manual) |

---

## 6. Plan de mejoras en 4 fases

### Fase A — Tooling + widgets base + CI (PR 1) ✅ COMPLETADA (2026-07-09)

Sin tocar diseño visual ni features de negocio.

- [x] Scripts npm: `typecheck`, `test`, `test:watch`, `lint`, `lint:fix`, `format`, `format:check`, `check`
- [x] ESLint + Prettier básico Vue/TS (`eslint.config.js` flat + `.prettierrc.json` / `.prettierignore`)
- [x] Un solo lockfile (eliminado `pnpm-lock.yaml`; queda `package-lock.json` → npm)
- [x] `interface/widgets/`: `PageHeader`, `EmptyState`, `AppSpinner`, `ConfirmDialog` (mismas clases Tailwind/Brasper ya usadas en pantallas)
- [x] CI: `.github/workflows/ci.yml` (npm ci → typecheck → lint → test → build)
- [x] `README.md` mínimo (setup, scripts, arquitectura, link CLAUDE/AGENTS)

**Extras de higiene:** fix `vue/valid-v-for` en `cuentas_bancarias_view.vue:365` (key por índice, sin cambio de comportamiento); `*.tsbuildinfo` gitignored y destrackeado.

**Estado del gate:** `npm run check` verde en local — typecheck OK · lint 0 errores / 11 avisos (deuda documentada) · 66 tests OK. `npm run build` y `npm ci` verdes.

### Fase B — Widgets adoption + modales + higiene auth UI (PR 2)

- [ ] Reemplazar `window.confirm` por `ConfirmDialog` en módulos críticos
- [ ] Adoptar PageHeader/EmptyState/AppSpinner en 2–3 views piloto (sin cambiar look)
- [ ] Split `BancoCrudModal` / `CuentaBancariaCreateFormModal` (form + shell)
- [ ] Gates `hasPermission` en botones mutables
- [ ] `validateBackofficeAccess` en router + guard DEV para credenciales login
- [ ] Eliminar stubs `accounts/`, `transactions/`, `user/`

### Fase C — Split transacciones (PR 3, el más grande)

- [ ] Extraer componentes/composables; view orquestador <300–500 líneas
- [ ] Facade multi-store; status helpers → domain o composable
- [ ] Extraer mappers del adapter (>500 → <300 + archivos mapper)
- [ ] Tests adapter parse + PUT quirk + permissions
- [ ] Congelar crecimiento: CI check opcional “no files >1000 sin allowlist”

### Fase D — CI gate + E2E + Capa 4 (PR 4)

- [ ] Playwright mínimo: login → transacciones list → logout
- [ ] Gate merge: adapters críticos + permissions + router client block
- [ ] Smoke post-deploy documentado (curl health/login/401)
- [ ] Documentar excepciones de capas en CLAUDE.md

---

## 7. Qué NO hacer

- Cambiar colores, tipografía, spacing visual o paleta `brasper.*` / `tailwind.config`
- Features nuevas de negocio
- Modificar API Django desde este front (solo adapters/normalización)
- Refactor masivo multi-módulo en un solo PR
- Copiar skills Stemis de otro stack (shadcn, NestJS, Prisma, UI design)

---

## 8. Definition of Done — “limpio limpio”

- [ ] Capa 1: `npm run check` pasa en local (<2 min)
- [ ] Capa 2: CI verde en cada PR
- [ ] Un solo lockfile
- [ ] `interface/widgets` con exports reales usados en ≥3 módulos
- [ ] Ningún body nuevo >1000 líneas; `transacciones_view` partido y <500 orquestador
- [ ] Client bloqueado en router; mutaciones gated por `hasPermission`
- [ ] Tests: permissions + transactions adapter mapping + calculator (ya parcial)
- [ ] README + AGENTS + CLAUDE alineados
- [ ] Cero cambios visuales perceptibles en pantallas existentes

---

## 9. Skills instaladas vs faltantes

### Ya instaladas

| Skill | `.agents/skills` | `.cursor/skills` |
|-------|:----------------:|:----------------:|
| brasper-backoffice-audit | ✅ | ✅ |
| brainstorming | ✅ | ✅ |
| thermo-nuclear-code-quality-review | ✅ | ✅ |
| vue-best-practices | ✅ | ❌ (solo en `.agents` / también en www) |

### No copiar de Stemis (otro stack / diseño)

- `shadcn-ui`, `next-best-practices`
- `nestjs-best-practices`, `prisma-expert`
- `interface-design`, `ui-ux-pro-max` (diseño visual)
- `dokploy-deploy`, `notion-stemis`

### Opcionales a considerar más adelante (no bloquean Fase A)

| Skill / tooling | Para qué |
|-----------------|----------|
| Copiar `vue-best-practices` a `.cursor/skills/` | Paridad Cursor ↔ Claude |
| Playwright skill / docs E2E | Fase D |
| Hook pre-push (typecheck+test) | Capa 1 automatizada |
| `FEATURE_MAP.md` ligero | Equivalente Stemis al inventario de módulos |

---

## 10. Inventario rápido de módulos

| Módulo | Capas | Notas |
|--------|-------|-------|
| auth | Completo | Incluye usuarios, roles, profile |
| transacciones | Completo | God view CRITICAL |
| tasas, comisiones, cupones, cuentas-bancarias, calculator, metrics | Completo | OK estructural |
| blog, home-banner | Sin application | View→adapter |
| world-cup | Parcial | domain + infra plana + presentation |
| dashboard, contabilidad | Solo presentation | Excepción conocida |
| accounts, transactions, user | Stubs | Eliminar |

**Tests actuales (7):**  
`use_calculator_store_controller.test.ts`, `special_calculator_bxp_analysis.test.ts`, `transaction_domain.test.ts`, `transaction_payload_guards.test.ts`, `transactions_api_list.test.ts`, `home_banner_api_adapter.test.ts`, `use_metric_chart_options.test.ts`.

---

*Fin Fase 1. **Estado de ejecución (2026-07-10):** Fase A ✅ · Fase B ✅ · Fase D ✅ · Fase C 🟡 (C1 y C3 ✅; C2 — split de `transacciones_view` a <500 líneas — pendiente como esfuerzo mayor). Detalle en [`docs/plans/00-ROADMAP.md`](../plans/00-ROADMAP.md).*
