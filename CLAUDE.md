# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite + PWA)
npm run build     # Type-check with vue-tsc, then Vite build
npm run preview   # Preview production build locally
```

There is no test suite configured.

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

## Naming conventions

The codebase uses **Spanish** for module names, route names, and many domain concepts (e.g., `transacciones`, `tasas`, `cupones`, `comisiones`, `cuentas-bancarias`). File names use `snake_case`. Vue components use `PascalCase`. Pinia store files are named `use_<module>_store_controller.ts`.
