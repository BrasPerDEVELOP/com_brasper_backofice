# Flujo de deploy seguro — Brasper Backoffice

> Adaptado de Stemis `docs/ops/DEPLOYMENT-FLOW.md` para SPA Vue + API Django externa.

## Principio

Cada capa atrapa una clase distinta de bug. Un cambio solo avanza si la capa anterior está verde.

```
  Local (pre-push)     →    CI PR          →    Gate merge      →    Prod
  npm run check             typecheck           + E2E (Fase D)        build dist/
  ~2 min                    lint test build     Playwright 5          smoke.sh
```

## Ramas sugeridas

| Rama | Rol |
|------|-----|
| `feature/*` | Trabajo por dev / por fase |
| `develop` | Integración |
| `main` | Producción |

Flujo: `feature` → PR `develop` → validar → PR `develop` → `main` → deploy.

## Las 4 capas

### 1. Pre-push (local) — Fase D

```bash
npm run check   # typecheck + lint + test
```

Opcional: `.husky/pre-push` ejecuta lo mismo al `git push`.

### 2. CI en PR — Fase A ✅

`.github/workflows/ci.yml` y `.gitea/workflows/ci.yml`:

```
npm ci → typecheck → lint → test → build
```

### 3. Gate merge a `main` — Fase D

Además de Capa 2:

- Playwright E2E (5 specs mínimos)
- Tests de `permissions` + transaction mappers
- No mergear con `transacciones_view.vue` creciendo sin allowlist

### 4. Post-deploy

```bash
./scripts/smoke.sh
```

- API responde
- 401 sin token
- Login smoke (credenciales en secrets)

## Qué atrapa cada capa

| Bug típico | Capa |
|------------|------|
| Error TypeScript | 1, 2 |
| Regresión lógica dominio | 1, 2 (vitest) |
| Permiso UI roto | 3 (E2E denied) |
| Build roto en Linux CI | 2 |
| API caída post-deploy | 4 (smoke) |

## Deploy SPA

Este repo genera `dist/` estático. Deploy según infra Brasper (rsync, S3, nginx, Docker).

**Pre-deploy checklist:**

```bash
npm run check
npm run build
# smoke contra staging API
./scripts/smoke.sh
```

## Incidentes — no relearn

- Cambiar label de botón → grep tests E2E y `hasPermission` keys
- Un solo lockfile (`package-lock.json`)
- No commitear `dist/`
- API quirks en adapters, no en views

## Plan de fases

[docs/plans/00-ROADMAP.md](../plans/00-ROADMAP.md)
