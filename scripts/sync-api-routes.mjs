/**
 * Regenera `scripts/api_routes.json`: el inventario de rutas que expone
 * com_brasper_api, con el permiso que exige cada una.
 *
 * Lo consume `src/interface/api/api_contract.test.ts` para verificar que ninguna
 * llamada del panel apunte a una ruta inexistente. Ejecútalo cuando el API
 * añada, quite o renombre endpoints.
 *
 *   npm run sync:api-routes
 *   API_REPO=/otra/ruta/com_brasper_api npm run sync:api-routes
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const apiRepo = process.env.API_REPO ?? resolve(here, '../../com_brasper_api')
const output = join(here, 'api_routes.json')

if (!existsSync(apiRepo)) {
  console.error(`No encuentro el repo del API en ${apiRepo}. Usa API_REPO=/ruta/al/repo.`)
  process.exit(1)
}

const python = ['venv/bin/python', '.venv/bin/python', 'python3']
  .map((candidate) => (candidate.includes('/') ? join(apiRepo, candidate) : candidate))
  .find((candidate) => candidate === 'python3' || existsSync(candidate))

// Se ejecuta dentro del repo del API porque su Settings lee el `.env` de ahí.
// AUTH_REQUIRED=false solo afecta a este proceso de inspección.
const script = `
import json, os, sys
sys.path.insert(0, ${JSON.stringify(apiRepo)})
from app.main import app

GUARDS = {
    "require_permission.<locals>.dependency",
    "require_any_permission.<locals>.dependency",
}

def permissions_of(route):
    found = set()
    stack = list(getattr(getattr(route, "dependant", None), "dependencies", []) or [])
    while stack:
        dep = stack.pop()
        call = getattr(dep, "call", None)
        if getattr(call, "__qualname__", "") in GUARDS:
            for cell in getattr(call, "__closure__", None) or ():
                try:
                    value = cell.cell_contents
                except ValueError:
                    continue
                if isinstance(value, str):
                    found.add(value)
                elif isinstance(value, tuple):
                    found.update(v for v in value if isinstance(v, str))
        stack.extend(getattr(dep, "dependencies", []))
    return sorted(found)

rows = []
for route in app.routes:
    path = getattr(route, "path", None)
    methods = getattr(route, "methods", None) or []
    if not path:
        continue
    # Los alias legacy con barra final no forman parte del contrato canónico.
    if path != "/" and path.endswith("/"):
        continue
    for method in sorted(m for m in methods if m not in ("HEAD", "OPTIONS")):
        rows.append({"method": method, "path": path, "permissions": permissions_of(route)})

rows.sort(key=lambda r: (r["path"], r["method"]))
with open(${JSON.stringify(output)}, "w") as handle:
    json.dump(rows, handle, indent=1)
print(len(rows))
`

const stdout = execFileSync(python, ['-c', script], {
  cwd: apiRepo,
  env: { ...process.env, AUTH_REQUIRED: 'false' },
  encoding: 'utf8'
})

const count = stdout.trim().split('\n').pop()
const routes = JSON.parse(readFileSync(output, 'utf8'))
writeFileSync(output, `${JSON.stringify(routes, null, 1)}\n`)
console.log(`${count} rutas canónicas escritas en scripts/api_routes.json`)
