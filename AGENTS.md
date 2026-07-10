# AGENTS.md — com_brasper_backofice

Vue 3 + TypeScript + Pinia + Vite. Backoffice Brasper (API Django externa). Clean Architecture por módulos.

## Roadmap de fases (empezar aquí)

| Fase | Estado | Documento |
|------|--------|-----------|
| A — Tooling + CI + widgets base | ✅ | [docs/plans/FASE-A.md](docs/plans/FASE-A.md) |
| B — Auth + permisos UI + widgets adoption | 🔲 **SIGUIENTE** | [docs/plans/FASE-B.md](docs/plans/FASE-B.md) |
| C — Split transacciones | 🔲 | [docs/plans/FASE-C.md](docs/plans/FASE-C.md) |
| D — E2E + pre-push + smoke | 🔲 | [docs/plans/FASE-D.md](docs/plans/FASE-D.md) |

Índice: [docs/plans/00-ROADMAP.md](docs/plans/00-ROADMAP.md)  
Mapa módulos: [FEATURE_MAP.md](FEATURE_MAP.md)  
Prompts Cursor: [docs/PROMPT-FASES.md](docs/PROMPT-FASES.md)

**Gate local:** `npm run check` antes de cada PR.

## Skills (`.agents/skills/` y `.cursor/skills/`)

| Skill | Cuándo usar |
|-------|-------------|
| **brasper-backoffice-audit** | Auditoría, flujo 4 capas, pre-merge |
| **brainstorming** | Features nuevas (no en refactors de fases) |
| **thermo-nuclear-code-quality-review** | God files, PR review estricto |
| **vue-best-practices** | Patrones Vue 3 |

## Capas de validación (Stemis)

| Capa | Estado | Qué |
|------|--------|-----|
| 1 Local | A ✅ / D 🔲 husky | `npm run check` |
| 2 CI PR | A ✅ | `.github` + `.gitea/workflows/ci.yml` |
| 3 Gate merge | D 🔲 | Playwright + tests permisos |
| 4 Deploy | D 🔲 | `scripts/smoke.sh` |

Ver [docs/ops/DEPLOYMENT-FLOW.md](docs/ops/DEPLOYMENT-FLOW.md).

## Scaffolds listos para codear

| Fase | Carpetas / archivos |
|------|---------------------|
| B | `src/modules/auth/infrastructure/parse_user.ts`, `use_permission_gate.ts` |
| C | `src/modules/transacciones/presentation/components/*.vue`, `composables/*.ts`, `infrastructure/mappers/` |
| D | `e2e/`, `playwright.config.ts`, `.husky/pre-push`, `scripts/smoke.sh` |

## Arquitectura UI (sin cambiar diseño)

```
interface/components/  → primitivos
interface/widgets/     → PageHeader, EmptyState, ConfirmDialog, AppSpinner, DataTable (C3)
modules/*/presentation/components/  → UI del módulo
modules/*/presentation/bodies/*_view.vue  → orquestador (<500 líneas objetivo)
```

## Convenciones

- Leer `CLAUDE.md` + `FEATURE_MAP.md` antes de editar
- Español en UI; inglés en código
- API solo vía `Domain.apiPath()` y `apiClient`
- Permisos: `module.action` en `permissions.ts`

## Invocación Cursor

```
Implementa Fase B según docs/plans/FASE-B.md. npm run check verde. Sin diseño visual.
```
