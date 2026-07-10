# Prompts por fase — Brasper Backoffice

Copiar y pegar en Cursor con el repo `com_brasper_backofice` abierto.

---

## Fase B

```
Fase B — com_brasper_backofice
Lee docs/plans/FASE-B.md y FEATURE_MAP.md.
Skills: brasper-backoffice-audit, vue-best-practices.

Implementa Fase B completa. Sin cambios visuales. Sin features nuevas.

Orden:
1. Router: validateBackofficeAccess / bloquear client tras restoreUser
2. login_view: credenciales solo import.meta.env.DEV
3. parse_user.ts canónico + refactor adapters
4. hasPermission en botones mutables (tabla en FASE-B.md)
5. ConfirmDialog reemplaza window.confirm
6. PageHeader/EmptyState/AppSpinner en cupones, comisiones, tasas
7. Split BancoCrudModal y CuentaBancariaCreateFormModal (shell + form)
8. Eliminar stubs accounts/, transactions/, user/

Al terminar: npm run check + build verdes. Actualiza 00-ROADMAP.md (Fase B ✅).
```

---

## Fase C — Sub-PR 1 (composables)

```
Fase C1 — transacciones composables
Lee docs/plans/FASE-C.md (Sub-PR C1).

Extrae lógica de transacciones_view.vue a composables sin cambiar comportamiento ni CSS.
Crear use_transaction_page_context, use_transaction_filters, use_transaction_status_labels.
Misma estética. npm run check verde. View debe bajar ≥800 líneas.
```

---

## Fase C — Sub-PR 2 (componentes)

```
Fase C2 — transacciones components
Lee docs/plans/FASE-C.md y src/modules/transacciones/presentation/components/README.md.

Un componente por commit: FiltersBar → Table → RowActions → Preview → Wizard → Import.
View orquestador solo. <1500 líneas al cerrar C2.
```

---

## Fase C — Sub-PR 3 (DataTable + mappers)

```
Fase C3 — DataTable + adapter mappers
Lee docs/plans/FASE-C.md (Sub-PR C3).

1. interface/widgets/DataTable.vue (misma estética tabla actual)
2. infrastructure/mappers/ para transactions_api_adapter
3. Tests parse_transaction + PUT quirk
Adapter <300 líneas. View <500 líneas.
```

---

## Fase D

```
Fase D — E2E + ops
Lee docs/plans/FASE-D.md.

1. Playwright: instalar, 5 specs en e2e/
2. playwright.config.ts + scripts test:e2e
3. husky pre-push → npm run check
4. scripts/smoke.sh funcional
5. .gitea/workflows/ci.yml (copia de GitHub)
6. Completar docs/ops/DEPLOYMENT-FLOW.md

npm run check + test:e2e verdes. Actualiza 00-ROADMAP.md.
```

---

## Auditoría completa (repetir)

```
Skill brasper-backoffice-audit + thermo-nuclear.
Genera docs/audits/AUDITORIA-YYYY-MM-DD.md.
Compara con docs/plans/00-ROADMAP.md y marca fases completadas.
Sin implementar. Sin diseño visual.
```
