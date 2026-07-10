# E2E — Playwright (Fase D)

Instalar:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Ejecutar:

```bash
npm run test:e2e
```

## Specs planificados

| Spec | Qué valida |
|------|------------|
| `auth/login.spec.ts` | Login admin |
| `auth/denied.spec.ts` | Sin permiso |
| `transacciones/list.spec.ts` | Lista carga |
| `navigation/sidebar.spec.ts` | Menú por rol |
| `smoke.spec.ts` | Health + login |

Ver [docs/plans/FASE-D.md](../docs/plans/FASE-D.md).
