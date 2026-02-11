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

export const Domain = {
  buildBaseUrl,
  http
}
