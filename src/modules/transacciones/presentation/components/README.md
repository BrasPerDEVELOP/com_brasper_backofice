# Componentes — módulo transacciones (Fase C2)

Extraer secciones de `presentation/bodies/transacciones_view.vue` sin cambiar clases CSS.

## Orden de implementación

1. `TransactionFiltersBar.vue`
2. `TransactionTable.vue`
3. `TransactionRowActionsMenu.vue`
4. `TransactionPreviewPanel.vue`
5. `TransactionCreateEditWizard.vue`
6. `TransactionImportSection.vue`
7. `TransactionPageHeader.vue` (si no quedó en view)

## Convención

- Props down, events up
- Lógica de negocio en composables (`../composables/`)
- No importar adapters aquí — solo stores o composables

## Estado scaffold

| Archivo | Estado |
|---------|--------|
| `TransactionFiltersBar.vue` | 🔲 scaffold |
| `TransactionTable.vue` | 🔲 scaffold |
| `TransactionRowActionsMenu.vue` | 🔲 scaffold |
| `TransactionPreviewPanel.vue` | 🔲 scaffold |
| `TransactionCreateEditWizard.vue` | 🔲 scaffold |
| `TransactionImportSection.vue` | 🔲 scaffold |
| `TransactionPageHeader.vue` | 🔲 scaffold |

Ver [docs/plans/FASE-C.md](../../../../docs/plans/FASE-C.md).
