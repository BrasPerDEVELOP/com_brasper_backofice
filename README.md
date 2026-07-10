# Brasper Backoffice

Backoffice de **Brasper** (fintech de cambio de divisas). SPA en **Vue 3 + TypeScript + Pinia + Vite**, con **Clean Architecture** por módulos. Consume una API Django externa.

## Requisitos

- **Node.js 22+** y **npm** (el proyecto usa `package-lock.json`; no usar pnpm/yarn).

## Setup

```bash
npm ci                # instalar dependencias (reproducible, desde el lockfile)
cp .env.example .env  # si existe; configurar variables VITE_* (ver más abajo)
npm run dev           # servidor de desarrollo (Vite + PWA)
```

## Scripts

| Script                 | Qué hace                                      |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo (Vite + PWA)           |
| `npm run build`        | Type-check (`vue-tsc`) + build de producción  |
| `npm run preview`      | Previsualizar el build de producción          |
| `npm run typecheck`    | Solo verificación de tipos (`vue-tsc -b`)     |
| `npm run lint`         | ESLint (Vue 3 + TS, flat config)              |
| `npm run lint:fix`     | ESLint con autofix                            |
| `npm run format`       | Prettier (escribe cambios)                    |
| `npm run format:check` | Prettier en modo verificación                 |
| `npm run test`         | Vitest una sola vez (CI)                      |
| `npm run test:watch`   | Vitest en modo watch                          |
| `npm run check`        | **Gate local**: `typecheck` + `lint` + `test` |

Antes de abrir un PR: `npm run check` en verde.

## Arquitectura

```
src/
  interface/            # Infraestructura compartida entre módulos
    api/                #   cliente axios, helpers de error
    infrastructure/     #   Domain (URL builder), logger, servicios
    config/             #   env.ts (wrapper tipado de import.meta.env)
    router/             #   Vue Router con guards por permiso
    layout/ · components/ · widgets/   # UI compartida
  modules/<nombre>/     # Módulos de negocio (Clean Architecture)
    domain/models/            # tipos puros
    application/use_cases/     # lógica de negocio (sobre interfaces de repo)
    infrastructure/adapters/   # adapters API que implementan los repos
    presentation/
      bodies/*_view.vue        # vistas de página (orquestador)
      controllers/use_*_store_controller.ts  # stores Pinia
      composables/ · components/
```

**Flujo de datos:** `*_view.vue` → store Pinia → use case → interfaz de repo →
adapter API → `apiClient` / `fetch`.

**Aliases:** `@/` → `src/`, `@interface` → `src/interface/`, `@modules` → `src/modules/`.

Widgets compartidos en [`src/interface/widgets`](src/interface/widgets/README.md):
`PageHeader`, `EmptyState`, `AppSpinner`, `ConfirmDialog`.

## Variables de entorno

Todas con prefijo `VITE_`. Principales:

| Variable                                              | Propósito                                          |
| ----------------------------------------------------- | -------------------------------------------------- |
| `VITE_API_BASE_URL`                                   | URL base de la API (prioridad sobre `VITE_DOMAIN`) |
| `VITE_DOMAIN`                                         | Dominio de respaldo si no hay `VITE_API_BASE_URL`  |
| `VITE_SSL`                                            | Forzar HTTPS (default: `true`)                     |
| `VITE_AUTH_HEADER_PREFIX`                             | Prefijo del header de auth (default: `Bearer`)     |
| `VITE_AUTH_PROFILE_PATH` / `VITE_AUTH_PROFILE_METHOD` | Endpoint y método de perfil                        |
| `VITE_TRANSACTIONS_IMPORT_PATH`                       | Endpoint de importación masiva de transacciones    |
| `VITE_USERNAME` / `VITE_PASSWORD`                     | Prefill de login (solo desarrollo)                 |

Lista completa y detalles en [`CLAUDE.md`](CLAUDE.md).

## Autenticación y permisos

- Roles: `admin`, `sales`, `accounting`, `marketing`, `client`, `user`.
- `admin` tiene todos los permisos; `client` está bloqueado del backoffice.
- Permisos con formato `module.action` en `src/modules/auth/domain/models/permissions.ts`.
- El token JWT se persiste en `localStorage` (riesgo XSS conocido y documentado).

## Testing

Vitest (`environment: node`). Ejecutar un archivo:

```bash
npx vitest run src/modules/calculator/presentation/controllers/use_calculator_store_controller.test.ts
```

## Plan de mejoras (estilo Stemis)

| Fase | Estado | Doc |
|------|--------|-----|
| A — Tooling + CI | ✅ | [FASE-A](docs/plans/FASE-A.md) |
| B — Auth + widgets | 🔲 **empezar aquí** | [FASE-B](docs/plans/FASE-B.md) |
| C — Split transacciones | 🔲 | [FASE-C](docs/plans/FASE-C.md) |
| D — E2E + smoke | 🔲 | [FASE-D](docs/plans/FASE-D.md) |

Índice completo: [`docs/plans/00-ROADMAP.md`](docs/plans/00-ROADMAP.md)  
Mapa módulos: [`FEATURE_MAP.md`](FEATURE_MAP.md)  
Prompts para Cursor: [`docs/PROMPT-FASES.md`](docs/PROMPT-FASES.md)

Antes de codear una fase: leer su doc y correr `npm run check`.

## Documentación relacionada

- [`CLAUDE.md`](CLAUDE.md) — guía detallada de arquitectura, comandos y convenciones.
- [`AGENTS.md`](AGENTS.md) — skills y flujo de trabajo para agentes de IA.
- [`docs/audits/`](docs/audits/) — auditorías de código.
- [`docs/ops/DEPLOYMENT-FLOW.md`](docs/ops/DEPLOYMENT-FLOW.md) — 4 capas de validación.
- [`docs/TESTING.md`](docs/TESTING.md) — Vitest + Playwright.
