import { apiClient } from '@/interface/api/client'
import { createLoggerWithContext } from '@/interface/infrastructure/logger'
import type {
  AuthRepository,
  ChangePasswordPayload,
  LoginResponse,
  UpdateProfilePayload
} from './auth_repository'
import type { User } from '../../domain/models'
import { normalizePermissions, normalizeStoredRole } from '../../domain/models'

const log = createLoggerWithContext('auth')

/** Rutas relativas al `baseURL` de axios (siempre HTTPS vía `.env` + interceptor). */
function authPath(subpath: string): string {
  const segment = subpath.replace(/^\/+/, '').replace(/\/+$/, '')
  return segment ? `auth/${segment}/` : 'auth/'
}

/**
 * Parsea el objeto user de la respuesta del backend.
 * GET /user/{id} devuelve: id, names, lastnames, email, profile_image,
 * document_number, document_type, is_agent, role, phone, code_phone.
 */
function parseUser(data: unknown): User | null {
  if (data === null || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const id = o.id ?? o.user_id
  if (id == null) return null
  const names = o.names != null ? String(o.names) : null
  const lastnames = o.lastnames != null ? String(o.lastnames) : null
  const email = (o.email ?? o.username) != null ? String(o.email ?? o.username) : ''
  const displayName = [names, lastnames].filter(Boolean).join(' ') || email
  const phoneVal = o.phone ?? o.telefono
  const phone = typeof phoneVal === 'number' ? phoneVal : (typeof phoneVal === 'string' && phoneVal ? Number(phoneVal) : null)
  const documentType = o.document_type ?? o.documentType ?? o.tipo_documento
  const codePhone = o.code_phone ?? o.codePhone ?? o.codigo_telefono
  const roleNorm = normalizeStoredRole(o.role)
  return {
    id: String(id),
    email,
    names,
    lastnames,
    name: displayName,
    document_number: o.document_number != null ? String(o.document_number) : null,
    document_type: documentType != null ? String(documentType) : null,
    profile_image: o.profile_image != null ? String(o.profile_image) : null,
    is_agent: Boolean(o.is_agent),
    role: roleNorm,
    phone: Number.isFinite(phone) ? phone : null,
    code_phone: codePhone != null ? String(codePhone) : null,
    permissions: normalizePermissions(o.permissions, roleNorm),
    must_change_password: Boolean(o.must_change_password)
  }
}

export class AuthApiAdapter implements AuthRepository {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<Record<string, unknown>>(authPath('login'), { username, password }, {
      headers: { 'Content-Type': 'application/json' }
    })
    let data = response.data
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as typeof response.data
      } catch {
        throw new Error('Respuesta de login inválida')
      }
    }

    const dataObj = data as Record<string, unknown>
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

    if (!token) {
      throw new Error('No se recibió token de sesión. Revisa la respuesta del servidor.')
    }

    if (import.meta.env.DEV) {
      log.debug('Usuario parseado:', { id: user.id, email: user.email, role: user.role })
    }

    return { user, token }
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
    if (payload.is_agent != null) body.is_agent = payload.is_agent
    if (payload.role != null && payload.role !== '') body.role = payload.role
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
