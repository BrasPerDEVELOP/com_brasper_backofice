# Roadmap de mejoras — Brasper Backoffice (estilo Stemis)

> **Objetivo:** fluidez de desarrollo, menos errores, CI verde, código mantenible.  
> **Regla dura:** sin cambios de diseño visual (colores Brasper, Tailwind, layout).

## Estado por fase

| Fase | Nombre | Estado | Doc | PR sugerido |
|------|--------|--------|-----|-------------|
| **A** | Tooling + widgets base + CI | ✅ Completada | [FASE-A.md](./FASE-A.md) | — |
| **B** | Auth UI + widgets adoption + higiene | ✅ Completada | [FASE-B.md](./FASE-B.md) | `feat/fase-b-auth-widgets` |
| **C** | Split transacciones + DataTable | 🟡 Parcial (C1 + C3 ✅; C2 split de vista pendiente) | [FASE-C.md](./FASE-C.md) | `feat/fase-c-transacciones-1` … `3` |
| **D** | E2E + pre-push + smoke + ops docs | ✅ Completada (branch protection D6 = config manual) | [FASE-D.md](./FASE-D.md) | `feat/fase-d-e2e-ops` |

> **Estado real (2026-07-10):** A, B y D completadas; C parcial. Detalle de C abajo.

### Fase C — detalle de avance

- ✅ **C1** `use_transaction_status_labels` (extraído + testeado) y
  `use_transaction_page_context` (facade multi-store, adoptado en la vista).
- ✅ **C3** mappers del adapter (`transactions_api_adapter` 609→288) con
  `parse_transaction` / `transaction_list_response` / `transaction_form_payload`
  + tests; widget `DataTable` implementado.
- 🔲 **C2** split de `transacciones_view` en componentes (`TransactionFiltersBar`,
  `TransactionTable`, `TransactionCreateEditWizard`, etc.) hasta orquestador
  <500 líneas. **Pendiente**: es el esfuerzo mayor (3 sub-PRs) y requiere smoke
  manual del wizard/preview/import contra backend; no se hizo a ciegas para no
  arriesgar la vista núcleo. Scaffolds listos en `presentation/components/`.

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
