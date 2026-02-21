import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import { createLoggerWithContext } from '@/interface/infrastructure/logger'
import type { AuthRepository, LoginResponse, UpdateProfilePayload } from './AuthRepository'
import type { User } from '../../domain/models'

const log = createLoggerWithContext('auth')

/**
 * Parsea el objeto user de la respuesta del backend.
 * Formato esperado: { token, user: { id, names, lastnames, email, profile_image?, document_number? } }
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
  return {
    id: String(id),
    email,
    names,
    lastnames,
    name: displayName,
    document_number: o.document_number != null ? String(o.document_number) : null,
    profile_image: o.profile_image != null ? String(o.profile_image) : null,
    role: o.role != null ? String(o.role) : null
  }
}

export class AuthApiAdapter implements AuthRepository {
  private base() {
    return Domain.http('/auth')
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const url = `${this.base()}/login/`
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
    const url = `${this.base()}/logout/`
    await apiClient.post(url, {}, { headers: { 'Content-Type': 'application/json' } }).catch((err) => {
      log.warn('Logout request failed', err)
    })
  }

  async getCurrentUser(): Promise<User | null> {
    const url = `${this.base()}/me/`
    const response = await apiClient.get<unknown>(url).catch(() => ({ data: null }))
    return parseUser(response?.data ?? null)
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<User | null> {
    const url = `${this.base()}/me/`
    const response = await apiClient.patch<unknown>(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    })
    return parseUser(response?.data ?? null)
  }

  async uploadProfileImage(file: File): Promise<User | null> {
    const url = `${this.base()}/me/`
    const formData = new FormData()
    formData.append('profile_image', file)
    const response = await apiClient.patch<unknown>(url, formData)
    return parseUser(response?.data ?? null)
  }
}
