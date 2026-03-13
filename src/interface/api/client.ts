import axios, { type AxiosInstance } from 'axios'

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

const baseURL = Domain.buildBaseUrl()

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request: inyectar Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    if (import.meta.env.DEV && config.url) {
      const method = (config.method ?? 'GET').toUpperCase()
      const url = config.url ?? ''
      log.debug(`${method} ${url}`, config.params ?? '')
    }
    return config
  },
  (err) => {
    log.error('Request error', err)
    return Promise.reject(err)
  }
)

// Response: 401 → cerrar sesión; resto de errores → logging
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
