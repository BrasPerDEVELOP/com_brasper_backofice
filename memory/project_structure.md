---
name: Project structure audit
description: Structural issues fixed and remaining anomalies in the codebase
type: project
---

## Fixed (2026-04-25)

1. **Casing errors (TS1261)** — `'./User'→'./user'`, `'./Coupon'→'./coupon'`, `'./Commission'→'./commission'` in domain model indices.
2. **Deleted `useAuthStore.ts`** — exact duplicate of `use_auth_store_controller.ts` (canonical); nobody imported it.
3. **Deleted `AuthApiAdapter.ts`** (PascalCase) — duplicate of `auth_api_adapter.ts`; index already exported the snake_case version.
4. **Renamed `Transaction.ts`→`transaction.ts`** — consistency with all other model files; updated `transaction_domain.ts` and `models/index.ts` imports.
5. **Added barrel exports** to `auth/domain/models/index.ts`: `USER_ROLES`, `USER_ROLE_LABELS`, `UserRole`, `PHONE_CODES`, `PHONE_CODE_COUNTRY`.
6. **Updated direct imports** of `user_roles`/`phone_codes` in `UsuarioCreateFormModal.vue`, `usuarios_view.vue`, `users_management_api_adapter.ts` to use barrel (`../../domain/models`).

## Known remaining anomalies (non-breaking)

- `contabilidad/` and `dashboard/` are view-only (no domain/application/infrastructure layers).
- `accounts/`, `transactions/`, `user/` are empty stubs with `.gitkeep`.
- `tasas_demo_compact.vue` uses snake_case instead of PascalCase convention.
- Empty placeholder files: `interface/presentation/index.ts`, `interface/widgets/index.ts`, `auth/presentation/widgets/index.ts` (intentional stubs).
- `coupon.ts` exists in both `calculator/domain/models/` and `cupones/domain/models/` with different structures (calculator uses a simplified version for discount logic).
