import { apiClient } from '@/interface/api/client'
import { env } from '@/interface/config/env'
import { Domain } from '@/interface/infrastructure/services'
import { createLoggerWithContext } from '@/interface/infrastructure/logger'
import type {
  AuthRepository,
  ChangePasswordPayload,
  FacebookLoginPayload,
  GoogleLoginPayload,
  LoginResponse,
  UpdateProfilePayload
} from './auth_repository'
import type { User } from '../../domain/models'
import { parseUser } from '../parse_user'

const log = createLoggerWithContext('auth')

/** Rutas relativas al `baseURL` de axios (siempre HTTPS vía `.env` + interceptor). */
function authPath(subpath: string): string {
  const segment = subpath.replace(/^\/+/, '').replace(/\/+$/, '')
  return Domain.apiPath(segment ? `auth/${segment}` : 'auth')
}

/**
 * Normaliza la respuesta de sesión, venga de `auth/login/` o del canje OAuth
 * (Facebook/Google): el backend a veces anida en `data` y alterna
 * `token`/`access_token`.
 */
function parseSessionResponse(raw: unknown): LoginResponse {
  let data = raw
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown
    } catch {
      throw new Error('Respuesta de login inválida')
    }
  }

  const dataObj = (data ?? {}) as Record<string, unknown>
  const nestedData =
    dataObj.data != null && typeof dataObj.data === 'object'
      ? (dataObj.data as Record<string, unknown>)
      : {}
  const rawUserPayload = dataObj.user ?? nestedData.user ?? data
  const userPayload =
    rawUserPayload != null && typeof rawUserPayload === 'object'
      ? {
          ...(rawUserPayload as Record<string, unknown>),
          permissions:
            (rawUserPayload as Record<string, unknown>).permissions ??
            dataObj.permissions ??
            nestedData.permissions,
          must_change_password:
            (rawUserPayload as Record<string, unknown>).must_change_password ??
            dataObj.must_change_password ??
            nestedData.must_change_password
        }
      : rawUserPayload
  const user = parseUser(userPayload)
  const token =
    [dataObj.token, dataObj.access_token, nestedData.token, nestedData.access_token].find(
      (v): v is string => typeof v === 'string' && v.length > 0
    ) ?? ''

  if (!user) {
    throw new Error('Respuesta de login inválida')
  }
  if (!user) {
    throw new Error('Respuesta de login inválida')
  }

  if (!token) {
    throw new Error('No se recibió token de sesión. Revisa la respuesta del servidor.')
  }
  if (!token) {
    throw new Error('No se recibió token de sesión. Revisa la respuesta del servidor.')
  }

  if (import.meta.env.DEV) {
    log.debug('Usuario parseado:', { id: user.id, email: user.email, role: user.role })
  }
  if (import.meta.env.DEV) {
    log.debug('Usuario parseado:', { id: user.id, email: user.email, role: user.role })
  }

  return { user, token }
}

/** Mensajes accionables para los fallos típicos del canje de un `code` OAuth. */
function describeOAuthLoginError(error: unknown, provider: string): string {
  const status = (error as { response?: { status?: number } }).response?.status
  const data = (error as { response?: { data?: unknown } }).response?.data
  const detail =
    data != null && typeof data === 'object' ? (data as Record<string, unknown>).detail : null
  if (typeof detail === 'string' && detail.trim()) return detail

  if (status === 404 || status === 405) {
    return `El servidor no tiene habilitado el inicio de sesión con ${provider}.`
  }
  if (status === 401 || status === 403) {
    return `Tu cuenta de ${provider} no está vinculada a un usuario del backoffice.`
  }
  return error instanceof Error
    ? error.message
    : `No se pudo iniciar sesión con ${provider}.`
}

/**
 * Canjea el `code` del diálogo OAuth por una sesión Brasper.
 * El backend hace el intercambio con el secret del proveedor (nunca sale al navegador).
 */
async function exchangeOAuthCode(
  path: string,
  payload: { code: string; redirectUri: string },
  provider: string
): Promise<LoginResponse> {
  try {
    const response = await apiClient.post<Record<string, unknown>>(
      path.replace(/^\/+/, ''),
      { code: payload.code, redirect_uri: payload.redirectUri },
      { headers: { 'Content-Type': 'application/json' }, skipAuthRedirect: true }
    )
    return parseSessionResponse(response.data)
  } catch (error) {
    if (error instanceof Error && !(error as { response?: unknown }).response) throw error
    log.warn(`${provider} login failed`, error)
    throw new Error(describeOAuthLoginError(error, provider))
  }
}

export class AuthApiAdapter implements AuthRepository {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<Record<string, unknown>>(authPath('login'), { username, password }, {
      headers: { 'Content-Type': 'application/json' }
    })
    return parseSessionResponse(response.data)
  }

  async loginWithFacebook(payload: FacebookLoginPayload): Promise<LoginResponse> {
    return await exchangeOAuthCode(env.facebookAuthPath, payload, 'Facebook')
  }

  async loginWithGoogle(payload: GoogleLoginPayload): Promise<LoginResponse> {
    return await exchangeOAuthCode(env.googleAuthPath, payload, 'Google')
  }

  async logout(): Promise<void> {
    // Sin barra final: POST auth/logout/ → 307 a http://apibras.../auth/logout (lento / bloqueado en el navegador).
    await apiClient
      .post('auth/logout', {}, {
        headers: { 'Content-Type': 'application/json' },
        skipAuthRedirect: true,
        timeout: 8_000
      })
      .catch((err) => {
        log.warn('Logout request failed', err)
      })
  }

  async getCurrentUser(userId: string): Promise<User | null> {
    void userId
    const response = await apiClient.get<unknown>(authPath('me')).catch(() => ({ data: null }))
    const raw = response?.data ?? null
    const parsedPayload =
      raw != null && typeof raw === 'object'
        ? ((raw as Record<string, unknown>).user ?? (raw as Record<string, unknown>).data ?? raw)
        : raw
    return parseUser(parsedPayload)
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<User | null> {
    let profileImage = typeof payload.profile_image === 'string' ? payload.profile_image : undefined
    if (payload.profile_image instanceof File) {
      const form = new FormData()
      form.append('profile_image', payload.profile_image)
      const uploadResponse = await apiClient.post<unknown>(authPath('me/profile-image'), form, {
        skipAuthRedirect: true
      })
      const rawUpload = uploadResponse.data
      if (rawUpload != null && typeof rawUpload === 'object') {
        const value = (rawUpload as Record<string, unknown>).profile_image
        if (typeof value === 'string') profileImage = value
      }
    }
    const body: Record<string, unknown> = {}
    if (payload.names != null && payload.names !== '') body.names = payload.names
    if (payload.lastnames != null && payload.lastnames !== '') body.lastnames = payload.lastnames
    if (payload.email != null && payload.email !== '') body.email = payload.email
    if (payload.document_number != null && payload.document_number !== '') body.document_number = payload.document_number
    if (payload.document_type != null && payload.document_type !== '') body.document_type = payload.document_type
    if (payload.phone != null) body.phone = payload.phone
    if (payload.code_phone != null && payload.code_phone !== '') body.code_phone = payload.code_phone
    if (profileImage) body.profile_image = profileImage
    const response = await apiClient.put<unknown>(authPath('me'), body, {
      headers: { 'Content-Type': 'application/json' },
      skipAuthRedirect: true
    })
    const raw = response?.data ?? null
    const parsedPayload =
      raw != null && typeof raw === 'object'
        ? ((raw as Record<string, unknown>).user ?? (raw as Record<string, unknown>).data ?? raw)
        : raw
    return parseUser(parsedPayload)
  }

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiClient.post(
      authPath('change-password'),
      {
        current_password: payload.current_password,
        new_password: payload.new_password
      },
      {
        headers: { 'Content-Type': 'application/json' },
        skipAuthRedirect: true
      }
    )
  }
}
