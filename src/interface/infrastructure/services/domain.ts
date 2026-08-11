import { env } from '@/interface/config/env'

function isLocalApiHost(hostOrDomain: string): boolean {
  const d = hostOrDomain.toLowerCase()
  return (
    d === 'localhost' ||
    d.startsWith('127.0.0.1') ||
    d.startsWith('localhost:') ||
    d.startsWith('0.0.0.0')
  )
}

/** Fuerza https en hosts remotos. */
function ensureHttpsUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProtocol)
    if (!isLocalApiHost(parsed.hostname)) {
      parsed.protocol = 'https:'
    }
    return parsed.toString()
  } catch {
    return trimmed
  }
}

/** Solo origen (sin path): `https://apibras.finzeler.com` */
function toApiOrigin(url: string): string {
  const secure = ensureHttpsUrl(url)
  try {
    const parsed = new URL(secure.includes('://') ? secure : `https://${secure}`)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return secure.replace(/\/$/, '')
  }
}

/**
 * Base del API desde `.env`:
 * - `VITE_API_BASE_URL` (prioridad)
 * - o `VITE_DOMAIN` + `VITE_SSL` (solo localhost puede ser http)
 */
function buildBaseUrl(): string {
  const override = env.apiBaseUrl
  if (override) return toApiOrigin(override)

  const domain = env.domain?.trim()
  if (!domain) {
    const protocol = env.ssl ? 'https' : 'http'
    return `${protocol}://localhost`
  }
  const company = env.company?.trim()
  const host = company ? `${company}.${domain}` : domain
  const useHttp = isLocalApiHost(domain) && !env.ssl
  const protocol = useHttp ? 'http' : 'https'
  return toApiOrigin(`${protocol}://${host}`)
}

/**
 * Path relativo canónico para axios (`baseURL` + path).
 * Conserva query/fragmento, pero la ruta no empieza ni termina en `/`.
 * Ej: apiPath('/auth/login/?next=app') → 'auth/login?next=app'
 */
function apiPath(path: string): string {
  const suffixIndex = path.search(/[?#]/)
  const pathname = suffixIndex >= 0 ? path.slice(0, suffixIndex) : path
  const suffix = suffixIndex >= 0 ? path.slice(suffixIndex) : ''
  const canonicalPath = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  return `${canonicalPath}${suffix}`
}

/**
 * URL absoluta HTTPS (fetch, enlaces, depuración).
 * Ej: apiUrl('transactions/') → 'https://apibras.../transactions'
 */
function apiUrl(path: string): string {
  const base = buildBaseUrl()
  const p = apiPath(path)
  const joined = p ? `${base}/${p}` : base
  return ensureHttpsUrl(joined)
}

/** @deprecated Preferir apiPath() con apiClient o apiUrl() con fetch. */
function http(path: string): string {
  return apiUrl(path)
}

/** URL completa para archivos media (ej: profile_image). */
function mediaUrl(relativePath: string): string {
  if (!relativePath || typeof relativePath !== 'string') return ''
  const trimmed = relativePath.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return ensureHttpsUrl(trimmed)
  }
  const base = env.mediaBaseUrl ? toApiOrigin(env.mediaBaseUrl) : buildBaseUrl()
  let path = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  if (path.startsWith('media/')) return `${base}/${path}`
  if (!path.includes('/')) path = `profile_images/${path}`
  return `${base}/media/${path}`
}

export const Domain = {
  buildBaseUrl,
  ensureHttpsUrl,
  apiPath,
  apiUrl,
  http,
  mediaUrl
}
