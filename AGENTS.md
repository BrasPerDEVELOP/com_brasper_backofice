# AGENTS.md — com_brasper_backofice

Vue 3 + TypeScript + Pinia + Vite. Backoffice Brasper (API Django externa). Clean Architecture por módulos.

## Skills (`.agents/skills/` y `.cursor/skills/`)

| Skill | Origen | Cuándo usar |
|-------|--------|-------------|
| **brasper-backoffice-audit** | Stemis (adaptada) | Auditoría completa, flujo 4 capas, pre-merge, "limpiar código" |
| **brainstorming** | Stemis | Antes de features nuevas o refactors grandes |
| **thermo-nuclear-code-quality-review** | Stemis | Review estricto de PR; god files; spaghetti |
| **vue-best-practices** | Proyecto | Composition API, composables, performance Vue |

### NO copiar de Stemis (otro stack o diseño)

- `shadcn-ui`, `next-best-practices` — React/Next.js
- `nestjs-best-practices`, `prisma-expert` — backend NestJS (API Django está fuera)
- `interface-design`, `ui-ux-pro-max` — **diseño visual** (no usar en auditoría de código)
- `dokploy-deploy`, `notion-stemis` — específicos Stemis

## Flujo recomendado (estilo Stemis)

```
1. brasper-backoffice-audit  → reporte en docs/audits/
2. brainstorming             → si hay features nuevas
3. Implementar por fases     → tooling → widgets → split views → CI
4. thermo-nuclear            → review final del PR
```

## Capas de validación

| Capa | Dónde | Qué |
|------|-------|-----|
| 1 Local | pre-push | typecheck + lint + vitest |
| 2 CI PR | Gitea/GitHub Actions | check + build |
| 3 Gate | merge main | tests adapters + permisos + E2E mínimo |
| 4 Deploy | post-release | smoke API + login |

## Arquitectura UI (sin cambiar diseño)

```
interface/components/  → primitivos (AppButton, AppModal, AppDateInput…)
interface/widgets/     → patrones (PageHeader, DataTable, ConfirmDialog…)
modules/*/presentation/components/  → UI del módulo
modules/*/presentation/bodies/*_view.vue  → orquestador (<300 líneas ideal)
```

## Convenciones

- Leer `CLAUDE.md` antes de editar
- Español en UI; inglés en código
- `snake_case` archivos; PascalCase componentes Vue
- API solo vía `Domain.apiPath()` y `apiClient`
- Permisos: `module.action` en `permissions.ts`

## Invocación en Cursor

- *"Usa brasper-backoffice-audit y genera el reporte"*
- *"Auditoría estilo Stemis sin tocar diseño"*
- *"thermo-nuclear en transacciones_view.vue"*
