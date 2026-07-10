# Roadmap de mejoras — Brasper Backoffice (estilo Stemis)

> **Objetivo:** fluidez de desarrollo, menos errores, CI verde, código mantenible.  
> **Regla dura:** sin cambios de diseño visual (colores Brasper, Tailwind, layout).

## Estado por fase

| Fase | Nombre | Estado | Doc | PR sugerido |
|------|--------|--------|-----|-------------|
| **A** | Tooling + widgets base + CI | ✅ Completada | [FASE-A.md](./FASE-A.md) | — |
| **B** | Auth UI + widgets adoption + higiene | 🔲 Pendiente | [FASE-B.md](./FASE-B.md) | `feat/fase-b-auth-widgets` |
| **C** | Split transacciones + DataTable | 🔲 Pendiente | [FASE-C.md](./FASE-C.md) | `feat/fase-c-transacciones-1` … `3` |
| **D** | E2E + pre-push + smoke + ops docs | 🔲 Pendiente | [FASE-D.md](./FASE-D.md) | `feat/fase-d-e2e-ops` |

## Orden de ejecución (no saltar)

```
A ✅  →  B  →  FEATURE_MAP (paralelo, 1 PR chico)  →  C (3 sub-PRs)  →  D
```

## Gate antes de cada PR

```bash
npm run check    # typecheck + lint + test
npm run build    # build producción
```

## Documentos de apoyo

| Archivo | Uso |
|---------|-----|
| [FEATURE_MAP.md](../../FEATURE_MAP.md) | Mapa módulo → ruta → permiso → API → store |
| [docs/ops/DEPLOYMENT-FLOW.md](../ops/DEPLOYMENT-FLOW.md) | 4 capas de validación |
| [docs/TESTING.md](../TESTING.md) | Pirámide de tests |
| [docs/PROMPT-FASES.md](../PROMPT-FASES.md) | Prompts listos para Cursor |
| [docs/audits/AUDITORIA-2026-07-09.md](../audits/AUDITORIA-2026-07-09.md) | Hallazgos originales |

## Definition of Done global

Ver checklist final en [FASE-D.md](./FASE-D.md#definition-of-done-global).

## Ramas (equipo)

```
feature/{iniciales}-fase-b-*  →  develop  →  main
```

- No push directo a `main`
- 1 fase (o sub-PR de Fase C) por PR
- Review + `npm run check` verde en CI
