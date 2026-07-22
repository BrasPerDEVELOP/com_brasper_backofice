# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite + PWA)
npm run build     # Type-check with vue-tsc, then Vite build
npm run preview   # Preview production build locally
npx vitest        # Run all tests (watch mode)
npx vitest run    # Run tests once (CI mode)
npx vitest run src/modules/calculator/presentation/controllers/use_calculator_store_controller.test.ts  # Run single test file
```

Vitest is configured in `vitest.config.ts` with `environment: 'node'`. Tests use `@pinia/testing` via `setActivePinia(createPinia())` in `beforeEach`. There is no `test` npm script — invoke via `npx vitest`.

## Architecture

This is a Vue 3 + TypeScript SPA backoffice for Brasper (a currency exchange fintech). It follows **Clean Architecture** with a strict module boundary structure.

### Path aliases (vite.config.ts)
- `@/` → `src/`
- `@interface` → `src/interface/`
- `@modules` → `src/modules/`

### Two top-level directories in `src/`

**`src/interface/`** — Shared, cross-module infrastructure:
- `api/client.ts` — Axios instance with auto-HTTPS enforcement. Auth callbacks (token getter + unauthorized redirect) are injected from `main.ts` after Pinia is created to avoid circular deps.
- `infrastructure/services/domain.ts` — URL builder (`Domain.apiPath()`, `Domain.apiUrl()`, `Domain.mediaUrl()`). All API calls must go through these helpers, never hardcode URLs.
- `config/env.ts` — Typed wrapper over `import.meta.env`; all `VITE_*` variables accessed here.
- `router/index.ts` — Vue Router with permission-based guards. Each route has `meta.permission`; `admin` role bypasses all checks.
- `layout/`, `components/`, `widgets/` — Shared UI primitives.

**`src/modules/`** — Feature modules. Each module follows this layer structure:
```
modules/<name>/
  domain/models/       # Pure TypeScript types/interfaces
  application/use_cases/  # Business logic; depend only on repository interfaces
  infrastructure/adapters/ # API adapters implementing repository interfaces
  presentation/
    bodies/            # Full-page view components (*_view.vue)
    controllers/       # Pinia stores (use_*_store_controller.ts)
    composables/       # Stateless composition logic
    components/        # Module-scoped components
```

### Data flow
View (`*_view.vue`) → Pinia store (`use_*_store_controller.ts`) → Use Case → Repository interface → API Adapter → `apiClient` / `fetch`

The API adapter parses raw API responses into domain models (field name normalization is handled extensively in the adapter layer to absorb backend inconsistencies — e.g., `resultado_comision` ↔ `commission_result`).

### State management (Pinia)
Each module has one Pinia store. The auth store (`useAuthStore`) is special: it persists session to `localStorage` under keys `token` and `auth_user`, and exposes `hasPermission(key)` used throughout the app.

### Auth & permissions
- Roles: `admin`, `sales`, `accounting`, `marketing`, `client`, `user`
- `admin` role has all permissions and bypasses checks
- `client` role is blocked from backoffice access entirely
- Permissions follow `module.action` format (e.g., `transactions.view`, `users.create`)
- Permission list lives in `src/modules/auth/domain/models/permissions.ts`

### API client design
- All requests are forced to HTTPS for non-localhost hosts
- `FormData` uploads use native `fetch` (not axios) for transactions POST to avoid Content-Type boundary issues
- Transaction PUT sends `id` in the body, not the URL path (backend quirk)
- `VITE_AUTH_HEADER_PREFIX` controls the auth header prefix (default: `Bearer`)

## Environment variables

Key `.env` variables (all prefixed `VITE_`):

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Primary API base URL (takes priority over VITE_DOMAIN) |
| `VITE_DOMAIN` | Fallback domain if no VITE_API_BASE_URL |
| `VITE_SSL` | Force HTTPS (default: true) |
| `VITE_DARK` | Dark theme toggle |
| `VITE_TRANSACTIONS_IMPORT_PATH` | Endpoint path for bulk transaction import |
| `VITE_AUTH_PROFILE_PATH` | Profile endpoint path (default: `me`) |
| `VITE_AUTH_PROFILE_METHOD` | `put` or `patch` for profile updates |
| `VITE_ADMIN_REDIRECT_SECRET` | Shared secret for SSO admin redirect |
| `VITE_USERNAME` / `VITE_PASSWORD` | Dev-only login prefill |

## Module inventory

Active modules (fully implemented): `auth`, `transacciones`, `tasas`, `comisiones`, `cupones`, `cuentas-bancarias`, `calculator`, `dashboard`, `contabilidad`, `home-banner`, `blog`.

The empty stub modules `transactions/`, `accounts/`, `user/` were removed in Fase B. Do not confuse them with the real modules `transacciones`, `cuentas-bancarias`, and `auth` (user management lives under `auth/usuarios`).

The `auth` module is larger than typical — it handles login, the unified user/bank-account workspace (`/app/usuarios`), profile, and role/permission management. The old `/app/cuentas` route redirects to `/app/usuarios?tab=accounts`; bank-account forms and state remain owned by `cuentas-bancarias` and are composed from the auth route view.

Corporate Brasper accounts are managed separately at `/app/cuentas-brasper`. This route exposes the existing `transactions/banks/` CRUD (reason social, bank, currency, country and account) under `company_bank_accounts.*` permissions. Do not merge these records with client `transactions/bank-accounts/` records.

The `calculator` module exports two Pinia stores from the same factory: `useCalculatorStore` (id: `calculator`) and `useCalculatorDemoStore` (id: `calculator-demo`). The demo store renders the public-facing embed without backend calls. The `calculationMode` field (`'normal'` | `'special'`) controls whether `localTaxRateOverrides` are applied to `effectiveTaxRates`.

Domain helper functions (pure, no store dependencies) live in `transaction_domain.ts` alongside the models — e.g., `normalizeTransactionStatus`, `resolveTransactionStatusForDisplay`, `roundMoneyAmount`. New pure transaction logic belongs here, not in the adapter or store.

## Naming conventions

The codebase uses **Spanish** for module names, route names, and many domain concepts (e.g., `transacciones`, `tasas`, `cupones`, `comisiones`, `cuentas-bancarias`). File names use `snake_case`. Vue components use `PascalCase`. Pinia store files are named `use_<module>_store_controller.ts`.
