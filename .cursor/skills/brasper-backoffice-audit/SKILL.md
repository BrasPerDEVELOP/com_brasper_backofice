---
name: brasper-backoffice-audit
description: Auditoría de calidad y flujo de trabajo para com_brasper_backofice (Vue 3 SPA). Inspirado en Stemis DEPLOYMENT-FLOW + stemis-qa-auditor. Usar antes de refactors grandes, pre-merge, o cuando el usuario pida "auditoría", "limpiar código", "menos errores", "copiar flujo Stemis". NO modifica diseño visual ni colores.
---

# Brasper Backoffice — Auditoría de calidad (estilo Stemis)

## Alcance

Proyecto: **Vue 3 + TypeScript + Pinia + Vite** en `com_brasper_backofice`.
Backend: API Django **externa** (adapters en `src/modules/*/infrastructure/adapters/`).

**Fuera de alcance de esta skill:** cambios de UI/diseño (colores, tipografía, layout visual). Solo estructura, calidad, CI, tests, arquitectura.

## Referencia Stemis (qué copiamos)

| Stemis | Brasper equivalente |
|--------|---------------------|
| 4 capas validación (`docs/ops/DEPLOYMENT-FLOW.md`) | pre-push → CI PR → gate merge → smoke deploy |
| `components/ui` + `components/shared` | `interface/components` + `interface/widgets` |
| `stemis-qa-auditor` pre-merge | Esta skill (read-only audit) |
| `FEATURE_MAP.md` | `CLAUDE.md` + `memory/project_structure.md` |
| ESLint + CI + E2E | **Gap actual** — prioridad de mejora |

## Las 4 capas (adaptadas)

### Capa 1 — Local (~2 min, cada dev)

```bash
npm run typecheck   # vue-tsc -b --noEmit
npm run lint        # cuando exista ESLint
npx vitest run      # tests unitarios
```

Bloquear push si falla.

### Capa 2 — CI en PR (~5–8 min)

En cada PR a `main` / `develop`:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test`
5. `npm run build`

### Capa 3 — Gate pre-producción

Antes de merge a `main` o tag release:

- Tests de `permissions.ts` + router guards
- Tests de adapters críticos (`transactions_api_adapter`, `auth_api_adapter`)
- E2E mínimo (cuando exista Playwright): login → transacciones → logout
- **No** archivos nuevos >1000 líneas sin justificación

### Capa 4 — Post-deploy smoke

- Health / login API
- `security_smoke` equivalente (curl headers, CORS, 401 sin token)
- Verificar permisos admin vs sales

## Checklist de auditoría (read-only)

Ejecutar en orden. Citar `archivo:línea` en hallazgos.

### A. Arquitectura

- [ ] Cada módulo activo sigue: `domain → use_cases → adapters → store → view`
- [ ] Módulos stub (`transactions/`, `user/`, `accounts/`) — eliminar o implementar
- [ ] `world-cup` y `dashboard`/`contabilidad` — ¿saltan capas? documentar excepción o alinear
- [ ] Views no importan >2 stores ajenos sin composable intermedio
- [ ] URLs solo vía `Domain.apiPath()` / `env.ts` — sin hardcode

### B. God files (bloqueadores)

| Umbral | Acción |
|--------|--------|
| >3000 líneas | **CRÍTICO** — plan de split obligatorio |
| >1000 líneas | **ALTO** — no agregar código; extraer componentes |
| >500 líneas en adapter | Revisar normalización; extraer mappers |

Archivo conocido crítico: `src/modules/transacciones/presentation/bodies/transacciones_view.vue`

### C. UI compartida (sin cambiar diseño)

- [ ] `interface/widgets/` tiene exports reales (no `export {}`)
- [ ] Patrones repetidos → `PageHeader`, `EmptyState`, `ConfirmDialog`, `DataTable`, `AppSpinner`
- [ ] Modales >400 líneas en `interface/components/` → dividir en form + shell
- [ ] **No** tocar `tailwind.config.js` ni paleta `brasper.*` en auditoría de código

### D. Auth y permisos

- [ ] Token solo en `localStorage` — documentar riesgo; evaluar refresh si backend lo da
- [ ] `hasPermission()` usado en router Y en UI (botones ocultos)
- [ ] Rol `client` bloqueado del backoffice
- [ ] `VITE_USERNAME`/`VITE_PASSWORD` no en builds de prod
- [ ] `parseUser` no duplicado en 3+ adapters — unificar parser

### E. API / adapters

- [ ] PUT con `id` en body (quirk backend) documentado en un solo lugar
- [ ] FormData usa `fetch` donde aplica — no romper con axios
- [ ] Field aliases (`resultado_comision` ↔ `commission_result`) en adapter, no en views
- [ ] Errores formateados con helper central (`interface/api/`)

### F. Tooling y higiene

- [ ] Un solo lockfile (`package-lock.json` OR `pnpm-lock.yaml`)
- [ ] Scripts: `test`, `typecheck`, `lint`, `check`
- [ ] CI workflow existe (`.gitea/workflows/` o `.github/workflows/`)
- [ ] `dist/` no commiteado
- [ ] README.md + AGENTS.md presentes

### G. Tests

- [ ] Vitest cubre dominio (`transaction_domain`, `permissions`)
- [ ] Adapters con tests de mapeo JSON → model
- [ ] Cobertura mínima objetivo: permisos, transacciones, calculator (ya parcial)

## Severidades

| Nivel | Criterio |
|-------|----------|
| **CRITICAL** | God file crece; auth bypass; secretos en cliente; CI ausente en equipo >2 devs |
| **HIGH** | Capas rotas; duplicación parser; view >1000 líneas |
| **MEDIUM** | Sin ESLint; widgets vacíos; tests <10 archivos |
| **LOW** | Naming inconsistente; docs faltantes |

## Output del auditor

Generar `docs/audits/AUDITORIA-YYYY-MM-DD.md` con:

1. **Resumen ejecutivo** (5 bullets)
2. **Hallazgos por severidad** (tabla: archivo, línea, problema, fix sugerido)
3. **Plan de mejoras en 4 fases** (A tooling, B widgets, C split transacciones, D CI/E2E)
4. **Qué NO hacer** (diseño, colores, cambiar API Django desde front)
5. **Definition of Done** para "limpio limpio"

## Workflow con otras skills

| Situación | Skill |
|-----------|-------|
| Feature nueva | `brainstorming` primero |
| Review duro de PR | `thermo-nuclear-code-quality-review` |
| Patrones Vue | `vue-best-practices` (ya en repo) |
| Auditoría completa | **esta skill** |

## Reglas para el agente implementador

1. **Auditoría primero, código después** — no refactor masivo sin reporte
2. **Sin cambios visuales** — mismo Tailwind, mismos colores Brasper
3. **Cambios mínimos por PR** — un módulo o una capa por vez
4. **Comportamiento idéntico** — refactors estructurales, no features nuevas en auditoría
5. Leer siempre `CLAUDE.md` y `memory/project_structure.md` antes de tocar código
