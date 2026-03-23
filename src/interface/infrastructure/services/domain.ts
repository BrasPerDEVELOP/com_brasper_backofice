import { env } from '@/interface/config/env'

/**
 * Construye la URL base del API a partir de la configuración de entorno.
 * Formato: (https|http)://[company.]domain
 */
function buildBaseUrl(): string {
  const domain = env.domain?.trim()
  if (!domain) {
    const protocol = env.ssl ? 'https' : 'http'
    return `${protocol}://localhost`
  }
  const protocol = env.ssl ? 'https' : 'http'
  const company = env.company?.trim()
  const host = company ? `${company}.${domain}` : domain
  return `${protocol}://${host}`
}

/**
 * Devuelve la URL absoluta para un path del API (sin barra inicial).
 * Ej: Domain.http('auth') → baseURL + '/auth'
 */
function http(path: string): string {
  const base = buildBaseUrl()
  const p = path.startsWith('/') ? path.slice(1) : path
  return p ? `${base}/${p}` : base
}

/** URL completa para archivos media (ej: profile_image). */
function mediaUrl(relativePath: string): string {
  if (!relativePath || typeof relativePath !== 'string') return ''
  const trimmed = relativePath.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const base = env.mediaBaseUrl || buildBaseUrl()
  let path = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  if (path.startsWith('media/')) return `${base}/${path}`
  if (!path.includes('/')) path = `profile_images/${path}`
  return `${base}/media/${path}`
}

export const Domain = {
  buildBaseUrl,
  http,
  mediaUrl
}
