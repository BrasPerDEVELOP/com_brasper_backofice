// Versión de la app derivada del commit de git.
//
// - Se usa en `vite.config.ts` para inyectar `__APP_VERSION__` en build/dev.
// - Se puede correr directo para inspeccionar la versión actual:
//     node scripts/app-version.mjs           # línea legible
//     node scripts/app-version.mjs --json     # objeto JSON
//     npm run version:info
//
// Todos los comandos git tienen fallback: si no hay repo (p. ej. build en un
// contenedor sin .git), cae a la versión de package.json sin romper el build.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function git(args, fallback = '') {
  try {
    return execSync(`git ${args}`, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim()
  } catch {
    return fallback
  }
}

function packageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * @returns {{version:string, flavor:string, commit:string, commitCount:number,
 *   branch:string, describe:string, commitDate:string, buildDate:string, dirty:boolean}}
 */
export function getAppVersion() {
  const version = packageVersion()
  const commit = git('rev-parse --short HEAD', 'nogit')
  const commitCount = Number(git('rev-list --count HEAD', '0')) || 0
  const branch = git('rev-parse --abbrev-ref HEAD', 'unknown')
  const describe = git('describe --tags --always --dirty', commit)
  const commitDate = git('log -1 --format=%cI', '')
  const dirty = git('status --porcelain', '') !== ''

  // "Sabor" legible: si hay tag usa `git describe` (ej. v1.2.0-3-gabc1234);
  // si no hay tag, compone semver base + build (nº de commits) + hash de commit.
  const hasTag = describe !== '' && !/^[0-9a-f]{7,40}(-dirty)?$/i.test(describe)
  const flavor = hasTag ? describe : `v${version}+${commitCount}.${commit}${dirty ? '-dirty' : ''}`

  return {
    version,
    flavor,
    commit,
    commitCount,
    branch,
    describe,
    commitDate,
    buildDate: new Date().toISOString(),
    dirty
  }
}

// CLI: solo cuando se ejecuta directamente (no al importar desde vite.config).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const v = getAppVersion()
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(v, null, 2)}\n`)
  } else {
    process.stdout.write(
      `${v.flavor}\n  commit:  ${v.commit} (${v.branch})\n  commits: ${v.commitCount}\n  fecha:   ${v.commitDate || 'n/d'}\n`
    )
  }
}
