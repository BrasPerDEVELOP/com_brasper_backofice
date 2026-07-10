# Fase D — E2E, pre-push, smoke, documentación ops

**Estado:** ✅ Completada (2026-07-10) — salvo D6 (branch protection = config manual en GitHub/Gitea)  
**PR sugerido:** `feat/fase-d-e2e-ops`  
**Depende de:** Fase B (permisos) recomendada antes de E2E de auth

> **Resumen de cierre:** Playwright instalado + config + helper de login real;
> specs `smoke` y `denied` corren sin backend (6 passed en local); `login`/`list`/
> `sidebar` se saltan sin credenciales. Scripts `test:e2e`. Husky `pre-push` con
> `npm run check` (+ `SKIP_PREPUSH=1`). CI job `e2e` (solo PR) en `.github` y `.gitea`.
> D6 (branch protection) es configuración manual en el servidor Git.

## Objetivo

Capas 3 y 4 estilo Stemis: gate merge con Playwright, pre-push local, smoke post-deploy.

---

## D1 — Playwright setup

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Archivos (scaffold en repo):**

```
e2e/
  helpers/auth.ts
  auth/login.spec.ts
  auth/denied.spec.ts
  transacciones/list.spec.ts
  navigation/sidebar.spec.ts
  smoke.spec.ts
playwright.config.ts
```

**Scripts en `package.json`:**

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

**Tareas:**

- [ ] `playwright.config.ts` — `baseURL` desde `VITE_*` o `http://localhost:5173`
- [ ] `webServer` en config: `npm run dev` para CI local
- [ ] Helper `loginAsAdmin(page)` — ver `e2e/helpers/auth.ts`
- [ ] 5 specs mínimos pasando contra dev + credenciales de `.env`

---

## D2 — CI: job E2E (gate merge)

**Archivo:** `.github/workflows/ci.yml` (job adicional o workflow `e2e.yml`)

```yaml
# Solo en PR a main (no cada push) — como Stemis
on:
  pull_request:
    branches: [main]
```

**Tareas:**

- [ ] Job `e2e` con `needs: [check]` o workflow separado
- [ ] Variables: `VITE_API_BASE_URL` apuntando a API de test/staging
- [ ] Artefacto report HTML en fallo

**Gitea Navia:** copiar a `.gitea/workflows/ci.yml` (misma sintaxis).

---

## D3 — Pre-push hook (Capa 1 automatizada)

```bash
npm install -D husky
npx husky init
```

**Archivo:** `.husky/pre-push`

```sh
#!/bin/sh
npm run check
```

**Tareas:**

- [ ] Documentar en README: `npm run prepare` si aplica
- [ ] Opcional: no bloquear si `SKIP_PREPUSH=1` (emergencias)

---

## D4 — Smoke post-deploy

**Archivo:** `scripts/smoke.sh` (scaffold incluido)

**Checks mínimos:**

- [ ] API responde (health o login endpoint)
- [ ] 401 sin token
- [ ] CORS headers (si aplica)
- [ ] Login con credenciales de smoke (secrets CI)

**Tareas:**

- [ ] Documentar en `docs/ops/DEPLOYMENT-FLOW.md`
- [ ] Skill opcional `.agents/skills/brasper-deploy/SKILL.md` (adaptar dokploy-deploy)

---

## D5 — Documentación ops

**Ya creados / completar:**

- [ ] `docs/ops/DEPLOYMENT-FLOW.md` — 4 capas
- [ ] `docs/TESTING.md` — pirámide Vitest + Playwright
- [ ] `FEATURE_MAP.md` — mantener al día
- [ ] Copiar `vue-best-practices` a `.cursor/skills/` (paridad)

---

## D6 — Ramas y protección

| Rama | Rol |
|------|-----|
| `develop` | Integración diaria |
| `main` | Producción |

**Tareas:**

- [ ] Branch protection en Gitea/GitHub: PR required, CI required
- [ ] E2E required solo para PR → `main`

---

## Definition of Done global

- [ ] Capa 1: `npm run check` + husky pre-push
- [ ] Capa 2: CI verde en cada PR
- [ ] Capa 3: E2E verde en PR → main
- [ ] Capa 4: `scripts/smoke.sh` documentado y ejecutable
- [ ] `interface/widgets` usados en ≥3 módulos
- [ ] `transacciones_view` <500 líneas (Fase C)
- [ ] Client bloqueado en router (Fase B)
- [ ] Tests: permissions + transaction mappers + calculator
- [ ] README + AGENTS + FEATURE_MAP alineados
- [ ] Cero cambio visual perceptible

## Prompt Cursor

Ver [docs/PROMPT-FASES.md](../PROMPT-FASES.md#fase-d).
