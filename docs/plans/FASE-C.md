# Fase C — Split transacciones + DataTable + tests adapter

**Estado:** 🟡 Parcial — C1 ✅ · C3 ✅ · C2 pendiente (2026-07-10)  
**PRs sugeridos:** 3 sub-PRs (no uno solo)  
**Tiempo estimado:** 1–2 semanas  
**Archivo crítico:** `transacciones_view.vue` (~5600 líneas)

> **Avance:** C1 (composable de labels/badges testeado + facade multi-store
> adoptado) y C3 (mappers `parse_transaction`/`transaction_list_response`/
> `transaction_form_payload` con tests; adapter 609→288; widget `DataTable`) están
> **completos y verificados**. **C2** (extraer `TransactionFiltersBar`/`Table`/
> `Wizard`/`Import`/… hasta orquestador <500 líneas) queda **pendiente**: es el
> esfuerzo mayor y exige smoke manual del wizard/preview/import contra backend
> antes de merge; no se ejecutó a ciegas para no arriesgar la vista núcleo.

## Objetivo

View orquestador <500 líneas; lógica en composables/components/domain; adapter <300 + mappers.

---

## Sub-PR C1 — Composables + domain helpers

**Crear:**

```
src/modules/transacciones/presentation/composables/
  use_transaction_page_context.ts    # facade multi-store
  use_transaction_filters.ts
  use_transaction_status_labels.ts   # mover getStatusLabel de la view
  README.md                          # ya existe como guía
```

**Mover desde view (sin cambiar comportamiento):**

- [ ] Resolución cuentas/monedas/asesor → `use_transaction_page_context`
- [ ] Labels/badges de estado → `use_transaction_status_labels` o `transaction_domain.ts`
- [ ] Tests unitarios de composables puros donde sea posible

**Gate:** `transacciones_view.vue` baja al menos 800 líneas; `npm run check` verde.

---

## Sub-PR C2 — Componentes de presentación

**Crear en** `src/modules/transacciones/presentation/components/`:

| Componente | Responsabilidad | Líneas view origen (aprox.) |
|------------|-----------------|------------------------------|
| `TransactionPageHeader.vue` | Título + acciones principales | ~2734+ |
| `TransactionFiltersBar.vue` | Filtros búsqueda/fecha/estado | ~2809+ |
| `TransactionTable.vue` | Tabla + sort + filas | ~2911+ |
| `TransactionRowActionsMenu.vue` | Menú acciones por fila | ~3245+ |
| `TransactionPreviewPanel.vue` | Panel preview | ~3326+ |
| `TransactionCreateEditWizard.vue` | Wizard crear/editar | ~3731+ |
| `TransactionImportSection.vue` | Import Excel | ~5426+ |

**Scaffold:** archivos `.vue` vacíos con props/events documentados en cada archivo — ver carpeta.

**Tareas:**

- [ ] Cortar template por secciones; **mismas clases CSS**
- [ ] View solo importa componentes + composables
- [ ] No llamar adapters desde la view (usar stores/use-cases)

**Gate:** view <1500 líneas.

---

## Sub-PR C3 — Widget DataTable + adapter mappers + tests

### C3a — `DataTable.vue` global

**Crear:** `src/interface/widgets/DataTable.vue`

- Props: `columns`, `rows`, `sortable`, `@row-click`
- Misma estética que tablas actuales en transacciones
- Export en `src/interface/widgets/index.ts`

### C3b — Mappers del adapter

**Crear:**

```
src/modules/transacciones/infrastructure/mappers/
  parse_transaction.ts
  transaction_form_payload.ts
  transaction_list_response.ts
```

**Refactor:** `transactions_api_adapter.ts` (609 → <300 líneas)

- [ ] PUT `id` en body documentado en un solo comentario canónico
- [ ] FormData + fetch permanece en adapter

### C3c — Tests

**Crear:**

- [ ] `parse_transaction.test.ts`
- [ ] `transaction_form_payload.test.ts` (PUT quirk)
- [ ] `permissions.test.ts` (si no existe desde Fase B)

**Gate final Fase C:**

- [ ] `transacciones_view.vue` <500 líneas (orquestador)
- [ ] `transactions_api_adapter.ts` <300 líneas
- [ ] `npm run check` verde
- [ ] Comportamiento idéntico (smoke manual: crear, editar, import, preview)

---

## Congelar crecimiento (opcional CI)

Añadir en Fase D o al cerrar C:

```bash
# scripts/check-file-sizes.sh — falla si body >1000 sin allowlist
```

Allowlist temporal: ninguna (objetivo: vacía).

---

## Orden de trabajo recomendado

1. Leer view completa y marcar regiones con comentarios `// REGION: filters`
2. C1 composables (más seguro, menos conflictos)
3. C2 un componente por commit (Filters → Table → Wizard → Import)
4. C3 DataTable + mappers + tests

## Prompt Cursor

Ver [docs/PROMPT-FASES.md](../PROMPT-FASES.md#fase-c).
