# Testing — Brasper Backoffice

> Pirámide adaptada de Stemis (70% unit · 20% integration · 10% E2E).

## Herramientas

| Capa | Tool | Ubicación |
|------|------|-----------|
| Unit | Vitest | `src/**/*.test.ts` |
| E2E | Playwright | `e2e/**/*.spec.ts` (Fase D) |
| Smoke | bash + curl | `scripts/smoke.sh` |

## Comandos

```bash
npm run test              # Vitest once (CI)
npm run test:watch        # Vitest watch
npx vitest run path/to/file.test.ts
npm run test:e2e          # Playwright (Fase D)
npm run check             # typecheck + lint + test
```

## Qué testear primero (ROI)

### Unit (Vitest) — prioridad

1. `permissions.ts` — defaults por rol, admin bypass, client limitado
2. `parse_user.ts` — mapeo JSON → user (Fase B)
3. `transaction_domain.ts` — ya parcial ✅
4. `parse_transaction.ts` — mappers adapter (Fase C)
5. `transactions_api_adapter` — PUT id-in-body, list parse

### E2E (Playwright) — Fase D mínimo

1. `auth/login.spec.ts` — admin login OK
2. `auth/denied.spec.ts` — sin permiso no accede
3. `transacciones/list.spec.ts` — tabla carga
4. `navigation/sidebar.spec.ts` — menú según rol
5. `smoke.spec.ts` — health + login

### No hacer (bajo ROI ahora)

- Snapshot de cada componente Vue
- E2E de import Excel completo (frágil; unit del parser primero)

## Patrón test Pinia

```typescript
import { setActivePinia, createPinia } from 'pinia'
beforeEach(() => setActivePinia(createPinia()))
```

## CI

Vitest en cada PR (`.github/workflows/ci.yml`).  
Playwright solo en PR → `main` (Fase D).

## Credenciales test

- Usar `.env.test` o secrets CI — **nunca** credenciales prod en repo
- `VITE_USERNAME` / `VITE_PASSWORD` solo `import.meta.env.DEV`
