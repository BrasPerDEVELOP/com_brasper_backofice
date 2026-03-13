import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import { createLoggerWithContext } from '@/interface/infrastructure/logger'
import type { AuthRepository, LoginResponse, UpdateProfilePayload } from './AuthRepository'
import type { User } from '../../domain/models'

const log = createLoggerWithContext('auth')

/** Base URL para auth: /auth */
function authBase() {
  return Domain.http('/auth')
}

/** Base URL para user: /user (PUT /user/ según backend) */
function userBase() {
  return Domain.http('/user')
}

/**
 * Parsea el objeto user de la respuesta del backend.
 * GET /user/{id} devuelve UserReadDTO: id, names, lastnames, email, profile_image,
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
    role: o.role != null ? String(o.role) : null,
    phone: Number.isFinite(phone) ? phone : null,
    code_phone: codePhone != null ? String(codePhone) : null
  }
}

export class AuthApiAdapter implements AuthRepository {
  async login(username: string, password: string): Promise<LoginResponse> {
    const url = `${authBase()}/login/`
    const response = await apiClient.post<{ user?: unknown; token?: string; data?: { user?: unknown } }>(url, { username, password }, {
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
    
    // Log para depuración (solo en desarrollo)
    if (import.meta.env.DEV) {
      log.debug('Respuesta de login recibida:', JSON.stringify(data, null, 2))
    }
    
    const userPayload = data?.user ?? data?.data?.user ?? data
    const user = parseUser(userPayload)
    const token = typeof data?.token === 'string' ? data.token : ''
    
    if (!user) {
       throw new Error('Respuesta de login inválida')
    }
    
    // Log para depuración (solo en desarrollo)
    if (import.meta.env.DEV) {
      log.debug('Usuario parseado:', { id: user.id, email: user.email, role: user.role })
    }
    
    return { user, token }
  }

  async logout(): Promise<void> {
    const url = `${authBase()}/logout/`
    await apiClient.post(url, {}, { headers: { 'Content-Type': 'application/json' } }).catch((err) => {
      log.warn('Logout request failed', err)
    })
  }

  async getCurrentUser(userId: string): Promise<User | null> {
    const url = `${userBase()}/${userId}`
    const response = await apiClient.get<unknown>(url).catch(() => ({ data: null }))
    const raw = response?.data ?? null
    const payload = raw != null && typeof raw === 'object'
      ? ((raw as Record<string, unknown>).user ?? (raw as Record<string, unknown>).data ?? raw)
      : raw
    return parseUser(payload)
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<User | null> {
    const url = `${userBase()}/`
    const form = new FormData()
    form.append('id', payload.id)
    if (payload.names != null && payload.names !== '') form.append('names', payload.names)
    if (payload.lastnames != null && payload.lastnames !== '') form.append('lastnames', payload.lastnames)
    if (payload.email != null && payload.email !== '') form.append('email', payload.email)
    if (payload.document_number != null && payload.document_number !== '') form.append('document_number', payload.document_number)
    if (payload.document_type != null && payload.document_type !== '') form.append('document_type', payload.document_type)
    if (payload.is_agent != null) form.append('is_agent', payload.is_agent ? 'true' : 'false')
    if (payload.role != null && payload.role !== '') form.append('role', payload.role)
    if (payload.phone != null) form.append('phone', String(payload.phone))
    if (payload.code_phone != null && payload.code_phone !== '') form.append('code_phone', payload.code_phone)
    if (payload.profile_image instanceof File) {
      form.append('profile_image', payload.profile_image)
    }
    if (import.meta.env.DEV) {
      const entries: Record<string, string> = {}
      form.forEach((v, k) => { entries[k] = v instanceof File ? `[File: ${v.name}]` : String(v) })
      log.debug('PUT /user/ FormData:', entries)
    }
    const response = await apiClient.put<unknown>(url, form, {
      skipAuthRedirect: true
    })
    return parseUser(response?.data ?? null)
  }
}
