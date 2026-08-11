/**
 * Gate de contrato: ninguna llamada del panel debe apuntar a una ruta que el API
 * no expone. Cubre el punto 6 de la Fase 1.1 del plan de estandarización de URLs.
 *
 * En vez de leer el código con expresiones regulares (que no resuelven los
 * helpers `endpoint()` ni las variables intermedias), ejecuta cada método de
 * cada adapter con `apiClient` espiado y compara las URLs realmente emitidas
 * contra `scripts/api_routes.json`, el inventario exportado de la app FastAPI.
 *
 * Si este test falla tras cambiar el API: regenera el inventario con
 * `npm run sync:api-routes` (necesita el repo com_brasper_api al lado).
 */
import { describe, expect, it, vi } from 'vitest'
import apiRoutes from '../../../scripts/api_routes.json'

const recorded: Array<{ method: string; url: string }> = []

function record(method: string) {
  return vi.fn((url: unknown) => {
    if (typeof url === 'string') recorded.push({ method, url })
    // Los adapters parsean `data`; devolver formas vacías evita ruido, y de
    // todas formas la URL ya quedó registrada antes de resolver la promesa.
    return Promise.resolve({ data: [] })
  })
}

vi.mock('@/interface/api/client', () => ({
  apiClient: {
    get: record('GET'),
    post: record('POST'),
    put: record('PUT'),
    patch: record('PATCH'),
    delete: record('DELETE'),
    request: record('GET')
  },
  getApiBaseUrl: () => 'https://api.test',
  refreshAccessToken: () => Promise.resolve('token'),
  triggerUnauthorized: vi.fn(),
  setAuthCallbacks: vi.fn()
}))

/** Normaliza a la forma del inventario: sin base, sin query, params como `{}`. */
function toPattern(url: string): string {
  const withoutBase = url.replace(/^https?:\/\/[^/]+/i, '')
  const path = withoutBase.split(/[?#]/)[0].replace(/^\/+/, '').replace(/\/+$/, '')
  return path
    .split('/')
    .map((segment) => (looksLikeIdentifier(segment) ? '{}' : segment))
    .join('/')
}

/** Un segmento es parámetro si es un UUID, un número o el placeholder de prueba. */
function looksLikeIdentifier(segment: string): boolean {
  return (
    segment === '{}' ||
    segment === PROBE_ID ||
    /^\d+$/.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
  )
}

const PROBE_ID = 'e3f1c2d4-0000-4000-8000-000000000001'

const KNOWN = new Set(
  (apiRoutes as Array<{ method: string; path: string }>).map(
    (route) => `${route.method} ${route.path.replace(/^\/+/, '').replace(/\/+$/, '')}`
  )
)

/** Compara el patrón emitido contra el inventario, tratando `{}` como comodín. */
function isKnown(method: string, pattern: string): boolean {
  if (KNOWN.has(`${method} ${pattern}`)) return true
  const emitted = pattern.split('/')
  for (const candidate of KNOWN) {
    const [candidateMethod, candidatePath] = candidate.split(' ')
    if (candidateMethod !== method) continue
    const expected = candidatePath.split('/')
    if (expected.length !== emitted.length) continue
    const matches = expected.every(
      (segment, index) =>
        segment.startsWith('{') || emitted[index] === '{}' || segment === emitted[index]
    )
    if (matches) return true
  }
  return false
}

/**
 * Rutas que el panel pide y el API no expone. Documentadas en vez de ignoradas
 * en silencio: si el API las añade, este test lo dirá y hay que quitarlas.
 */
const CONOCIDAS_SIN_RUTA = new Set([
  // El API no tiene endpoints de historial; la UI de tasas y comisiones muestra
  // el error del 404 en su lugar. Preexistente al cambio de JWT/auditoría.
  'GET coin/commission/{}/history',
  'GET coin/tax-rate/{}/history',
  'GET coin/tax-rate-trial/{}/history',
  // Reintento heredado de deleteUser(): solo se usa si DELETE /user/{id} falla,
  // y ese sí existe. Ver users_management_api_adapter.deleteUser.
  'DELETE user'
])

// Los `.test.ts` quedan fuera del glob, no solo del recorrido: importarlos
// ejecutaría sus `describe` y sus propios `vi.mock` sobre este mismo módulo.
const adapterModules = import.meta.glob(
  [
    '../../modules/**/infrastructure/adapters/*_api_adapter.ts',
    '!**/*.test.ts',
    '!**/*_repository.ts'
  ],
  { eager: true }
)

/** Invoca todo lo invocable de cada adapter para que emita sus URLs. */
async function probeEverything(): Promise<void> {
  const probeArgs = [PROBE_ID, { id: PROBE_ID, items: [] }]

  for (const [path, moduleExports] of Object.entries(adapterModules)) {
    if (path.includes('_repository') || path.includes('.test.')) continue
    for (const exported of Object.values(moduleExports as Record<string, unknown>)) {
      if (typeof exported !== 'function') continue

      const isClass = /^class\s/.test(exported.toString())
      if (isClass) {
        let instance: Record<string, unknown>
        try {
          instance = new (exported as new () => Record<string, unknown>)()
        } catch {
          continue
        }
        const prototype = Object.getPrototypeOf(instance)
        for (const name of Object.getOwnPropertyNames(prototype)) {
          if (name === 'constructor') continue
          const method = (instance as Record<string, unknown>)[name]
          if (typeof method !== 'function') continue
          await callSafely(() => (method as (...a: unknown[]) => unknown).apply(instance, probeArgs))
        }
      } else {
        await callSafely(() => (exported as (...a: unknown[]) => unknown)(...probeArgs))
      }
    }
  }
}

async function callSafely(invoke: () => unknown): Promise<void> {
  try {
    await invoke()
  } catch {
    // Los adapters validan argumentos y parsean respuestas; que fallen después
    // de construir la URL es irrelevante para este contrato.
  }
}

describe('contrato de endpoints frontend ↔ API', () => {
  it('toda llamada del panel apunta a una ruta que el API expone', async () => {
    await probeEverything()

    expect(recorded.length).toBeGreaterThan(20)

    const desconocidas = new Set<string>()
    for (const { method, url } of recorded) {
      const pattern = `${method} ${toPattern(url)}`
      if (!isKnown(method, toPattern(url)) && !CONOCIDAS_SIN_RUTA.has(pattern)) {
        desconocidas.add(pattern)
      }
    }

    expect([...desconocidas].sort()).toEqual([])
  })

  it('las excepciones documentadas siguen ausentes del inventario', () => {
    for (const entry of CONOCIDAS_SIN_RUTA) {
      const [method, pattern] = entry.split(' ')
      expect(isKnown(method, pattern), `${entry} ya existe en el API: quítala de la lista`).toBe(
        false
      )
    }
  })

  it('ninguna ruta del inventario termina en barra', () => {
    const conBarra = (apiRoutes as Array<{ path: string }>)
      .map((route) => route.path)
      .filter((path) => path !== '/' && path.endsWith('/'))
    expect(conBarra).toEqual([])
  })
})
