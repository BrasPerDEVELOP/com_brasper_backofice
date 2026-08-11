import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig
} from 'axios'
import { Domain } from '@/interface/infrastructure/services'
import { createLoggerWithContext } from '@/interface/infrastructure/logger'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

const log = createLoggerWithContext('api')

export type GetTokenFn = () => string | null
export type SetTokenFn = (token: string | null) => void
export type OnUnauthorizedFn = () => void

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _authRetry?: boolean
  skipAuthRedirect?: boolean
}

let getToken: GetTokenFn = () => null
let setToken: SetTokenFn = () => undefined
let onUnauthorized: OnUnauthorizedFn = () => undefined

export function setAuthCallbacks(
  tokenFn: GetTokenFn,
  tokenSetter: SetTokenFn,
  unauthorizedFn: OnUnauthorizedFn
): void {
  getToken = tokenFn
  setToken = tokenSetter
  onUnauthorized = unauthorizedFn
}

const AUTH_PREFIX = (import.meta.env.VITE_AUTH_HEADER_PREFIX as string)?.trim() || 'Bearer'

export function getApiBaseUrl(): string {
  return Domain.buildBaseUrl()
}

function toRelativePath(url: string | undefined): string {
  if (!url?.trim()) return ''
  const raw = url.trim()
  if (!/^https?:\/\//i.test(raw)) return Domain.apiPath(raw)
  try {
    const parsed = new URL(Domain.ensureHttpsUrl(raw))
    return Domain.apiPath(`${parsed.pathname}${parsed.search}${parsed.hash}`)
  } catch {
    return Domain.apiPath(raw)
  }
}

function applyApiRequestUrl(config: InternalAxiosRequestConfig): void {
  const relative = toRelativePath(config.url)
  config.baseURL = ''
  config.url = relative ? Domain.apiUrl(relative) : getApiBaseUrl()
}

function targetsApi(config: Pick<InternalAxiosRequestConfig, 'url' | 'baseURL'>): boolean {
  try {
    return new URL(config.url ?? '', config.baseURL || getApiBaseUrl()).origin ===
      new URL(getApiBaseUrl()).origin
  } catch {
    return false
  }
}

function canonicalRequestPath(config: Pick<InternalAxiosRequestConfig, 'url' | 'baseURL'>): string {
  try {
    return new URL(config.url ?? '', config.baseURL || getApiBaseUrl()).pathname.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export const apiClient: AxiosInstance = axios.create({
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' }
})

const refreshClient = axios.create({ timeout: 30_000 })
let refreshPromise: Promise<string> | null = null

async function requestNewAccessToken(): Promise<string> {
  const response = await refreshClient.post<unknown>(Domain.apiUrl('auth/refresh'), null, {
    withCredentials: true,
    headers: { 'X-Client-App': 'backoffice' }
  })
  const payload = response.data as Record<string, unknown> | null
  const token = payload && typeof payload.access_token === 'string' ? payload.access_token : ''
  if (!token) throw new Error('La renovación no devolvió un access token')
  setToken(token)
  return token
}

/** Comparte una única renovación entre todas las peticiones 401 concurrentes. */
export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export function triggerUnauthorized(): void {
  setToken(null)
  onUnauthorized()
}

apiClient.interceptors.request.use(
  (config) => {
    applyApiRequestUrl(config)
    const isApi = targetsApi(config)
    config.withCredentials = isApi
    if (isApi) {
      config.headers.set('X-Client-App', 'backoffice')
      const token = getToken()
      if (token) config.headers.set('Authorization', `${AUTH_PREFIX} ${token}`)
    } else {
      config.headers.delete('Authorization')
    }
    if (config.data instanceof FormData) {
      const headers = AxiosHeaders.from(config.headers)
      headers.delete('Content-Type')
      config.headers = headers
    }
    if (import.meta.env.DEV && config.url) {
      log.debug(`${(config.method ?? 'GET').toUpperCase()} ${config.url}`, config.params ?? '')
    }
    return config
  },
  (error: unknown) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined
    const status = error.response?.status
    const path = config ? canonicalRequestPath(config) : ''
    const isAuthEntryPoint = path.endsWith('/auth/login') || path.endsWith('/auth/refresh')

    if (status === 401 && config && targetsApi(config) && !config._authRetry && !isAuthEntryPoint) {
      config._authRetry = true
      try {
        const token = await refreshAccessToken()
        config.headers.set('Authorization', `${AUTH_PREFIX} ${token}`)
        return await apiClient.request(config)
      } catch (refreshError) {
        setToken(null)
        if (!config.skipAuthRedirect) onUnauthorized()
        return Promise.reject(refreshError)
      }
    }

    log.error(
      'API error',
      status ?? error.code ?? 'network',
      config?.url ?? error.request?.responseURL,
      error.response?.data ?? error.message
    )
    return Promise.reject(error)
  }
)
