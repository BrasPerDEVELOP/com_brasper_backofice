import axios, { type AxiosInstance, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}
import { Domain } from '@/interface/infrastructure/services'
import { createLoggerWithContext } from '@/interface/infrastructure/logger'

const log = createLoggerWithContext('api')

/** Proveedor de token (ej. desde store o localStorage). */
export type GetTokenFn = () => string | null

/** Callback cuando el backend responde 401 (token inválido/expirado). */
export type OnUnauthorizedFn = () => void

let getToken: GetTokenFn = () =>
  typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
let onUnauthorized: OnUnauthorizedFn = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('token')
    localStorage.removeItem('auth_user')
  }
  if (typeof window !== 'undefined') window.location.href = '/'
}

/**
 * Configura callbacks de auth. Llamar desde main.ts tras crear Pinia y Router
 * para usar el store y redirigir con Vue Router.
 */
export function setAuthCallbacks(
  tokenFn: GetTokenFn,
  unauthorizedFn: OnUnauthorizedFn
): void {
  getToken = tokenFn
  onUnauthorized = unauthorizedFn
}

const AUTH_PREFIX = (import.meta.env.VITE_AUTH_HEADER_PREFIX as string)?.trim() || 'Bearer'

/** Base HTTPS del API desde `.env` (`VITE_API_BASE_URL` o `VITE_DOMAIN`). */
export function getApiBaseUrl(): string {
  return Domain.buildBaseUrl()
}

/** Path relativo sin barra inicial (para combinar con base). */
function toRelativePath(url: string | undefined): string {
  if (!url?.trim()) return ''
  const raw = url.trim()
  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^\/+/, '')
  }
  try {
    const parsed = new URL(Domain.ensureHttpsUrl(raw))
    const path = parsed.pathname.replace(/^\//, '')
    return (path || '') + parsed.search
  } catch {
    return raw.replace(/^\/+/, '')
  }
}

/**
 * Cada petición usa URL absoluta HTTPS.
 * Evita que axios reutilice un baseURL en http (p. ej. .env antiguo sin reiniciar Vite).
 */
function applyHttpsRequestUrl(config: InternalAxiosRequestConfig): void {
  const base = getApiBaseUrl()
  const relative = toRelativePath(config.url)
  const absolute = relative ? Domain.apiUrl(relative) : base
  config.baseURL = ''
  config.url = absolute
}

export const apiClient: AxiosInstance = axios.create({
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json'
  }
})

/** Para `fetch` + FormData: misma auth que axios, sin Content-Type (boundary del navegador). */
export function getApiAuthHeaders(): HeadersInit {
  const token = getToken()
  if (!token) return {}
  return { Authorization: `${AUTH_PREFIX} ${token}` }
}

export function triggerUnauthorized(): void {
  onUnauthorized()
}

apiClient.interceptors.request.use(
  (config) => {
    applyHttpsRequestUrl(config)

    const token = getToken()
    if (token) {
      config.headers.Authorization = `${AUTH_PREFIX} ${token}`
    }
    if (config.data instanceof FormData) {
      const headers = AxiosHeaders.from(config.headers ?? {})
      headers.delete('Content-Type')
      config.headers = headers
    }
    if (import.meta.env.DEV && config.url) {
      const method = (config.method ?? 'GET').toUpperCase()
      log.debug(`${method} ${config.url}`, config.params ?? '')
    }
    return config
  },
  (err) => {
    log.error('Request error', err)
    return Promise.reject(err)
  }
)

apiClient.interceptors.response.use(
  (response) => response,
  (err) => {
    const status = err.response?.status
    const url = err.config?.url ?? err.request?.url
    const skipAuthRedirect = (err.config as { skipAuthRedirect?: boolean })?.skipAuthRedirect === true

    if (status === 401 && !skipAuthRedirect) {
      log.warn('401 Unauthorized', url, '→ cerrando sesión')
      onUnauthorized()
      return Promise.reject(err)
    }

    log.error(
      'API error',
      status ?? err.code ?? 'network',
      url,
      err.response?.data ?? err.message
    )
    return Promise.reject(err)
  }
)

if (import.meta.env.DEV) {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (raw?.toLowerCase().startsWith('http://')) {
    console.warn(
      '[api] VITE_API_BASE_URL usa http://; las peticiones se fuerzan a HTTPS. ' +
        'Actualiza .env y reinicia `npm run dev`.'
    )
  }
}
