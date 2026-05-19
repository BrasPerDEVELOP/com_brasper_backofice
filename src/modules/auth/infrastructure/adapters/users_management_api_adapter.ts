import axios from 'axios'
import { apiClient } from '@/interface/api/client'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import { Domain } from '@/interface/infrastructure/services'
import { USER_ROLES } from '../../domain/models'

export { USER_ROLES }

export const DEFAULT_USER_TEMPORARY_PASSWORD = 'Pass123!'

export interface UserListItem {
  id: string
  name: string
  email: string
  role?: string
  names?: string
  lastnames?: string
  document_number?: string
  document_type?: string
  phone?: number | null
  code_phone?: string | null
}

function parseUser(item: unknown): UserListItem | null {
  if (item == null || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const id = o.id ?? o.user_id
  if (id == null) return null
  const names = (o.names ?? '').toString().trim()
  const lastnames = (o.lastnames ?? '').toString().trim()
  const email = (o.email ?? o.username ?? '').toString().trim()
  const fullName = [names, lastnames].filter(Boolean).join(' ') || email || String(id)
  const role = o.role != null ? String(o.role) : undefined
  const document_number = o.document_number != null ? String(o.document_number) : undefined
  const document_type = o.document_type != null ? String(o.document_type) : undefined
  const phoneVal = o.phone ?? o.telefono
  const phone =
    typeof phoneVal === 'number'
      ? phoneVal
      : typeof phoneVal === 'string' && phoneVal.trim()
        ? Number(phoneVal)
        : null
  const codePhone = o.code_phone ?? o.codePhone ?? o.codigo_telefono
  return {
    id: String(id),
    name: fullName,
    email: email || '-',
    role,
    names: names || undefined,
    lastnames: lastnames || undefined,
    document_number,
    document_type,
    phone: Number.isFinite(phone) ? phone : null,
    code_phone: codePhone != null ? String(codePhone) : null
  }
}

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw != null && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const arr = obj.data ?? obj.results ?? obj.items ?? obj.users
    if (Array.isArray(arr)) return arr
  }
  return []
}

export interface FetchUsersParams {
  /** Filtro por ID de usuario (UUID). */
  user_id?: string | null
  /** Filtro por rol (user, sales, admin, client, marketing, accounting). */
  role?: string | null
}

/** Lista usuarios con filtros opcionales. GET /user/ */
export async function fetchUsers(params?: FetchUsersParams): Promise<UserListItem[]> {
  const url = Domain.apiPath('user/')
  const query: Record<string, string> = {}
  if (params?.user_id?.trim()) query.user_id = params.user_id.trim()
  if (params?.role?.trim()) query.role = params.role.trim()
  const response = await apiClient.get<unknown>(url, {
    params: query,
    headers: { Accept: 'application/json' },
    skipAuthRedirect: true
  })
  const raw = response.data
  const arr = Array.isArray(raw) ? raw : extractArray(raw)
  const users = arr.map(parseUser).filter((u): u is UserListItem => u != null)
  return users.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** @deprecated Use fetchUsers instead. */
export async function fetchAllUsers(): Promise<UserListItem[]> {
  return fetchUsers()
}

export interface CreateUserPayload {
  email?: string
  names?: string
  lastnames?: string
  role?: string
  password?: string
  document_number?: string
  document_type?: string
  profile_image?: File | null
  phone?: number | string | null
  code_phone?: string
}

export interface UpdateUserPayload extends Omit<CreateUserPayload, 'email' | 'password'> {
  id: string
  email?: string
}

function appendUserFormFields(
  form: FormData,
  payload: CreateUserPayload | UpdateUserPayload
) {
  if (payload.email?.trim()) form.append('email', payload.email.trim())
  if (payload.names?.trim()) form.append('names', payload.names.trim())
  if (payload.lastnames?.trim()) form.append('lastnames', payload.lastnames.trim())
  if (payload.role?.trim()) form.append('role', payload.role.trim())
  if ('password' in payload && payload.password?.trim()) form.append('password', payload.password.trim())
  if (payload.document_number?.trim()) form.append('document_number', payload.document_number.trim())
  if (payload.document_type?.trim()) form.append('document_type', payload.document_type.trim())
  const phoneVal = payload.phone
  const phoneNum =
    phoneVal != null && phoneVal !== ''
      ? (typeof phoneVal === 'number' ? phoneVal : Number(phoneVal))
      : null
  if (phoneNum != null && Number.isFinite(phoneNum)) form.append('phone', String(phoneNum))
  if (payload.code_phone?.trim()) form.append('code_phone', payload.code_phone.trim())
  if (payload.profile_image instanceof File) form.append('profile_image', payload.profile_image)
}

/** Crea un nuevo usuario. POST /user/ (multipart/form-data) */
export async function createUser(payload: CreateUserPayload): Promise<UserListItem> {
  const url = Domain.apiPath('user/')
  const form = new FormData()
  appendUserFormFields(form, {
    ...payload,
    password: payload.password?.trim() || DEFAULT_USER_TEMPORARY_PASSWORD
  })

  const response = await apiClient.post<unknown>(url, form)
  const raw = response.data
  const user = parseUser(
    (raw != null && typeof raw === 'object' && 'user' in raw)
      ? (raw as Record<string, unknown>).user
      : raw
  )
  if (!user) {
    throw new Error('Respuesta de creación de usuario inválida')
  }
  return user
}

/** Actualiza un usuario. PUT /user/ (multipart/form-data con id). */
export async function updateUser(payload: UpdateUserPayload): Promise<UserListItem> {
  const url = Domain.apiPath('user/')
  const form = new FormData()
  form.append('id', payload.id)
  appendUserFormFields(form, payload)

  const response = await apiClient.put<unknown>(url, form, {
    skipAuthRedirect: true
  })
  const raw = response.data
  const user = parseUser(
    raw != null && typeof raw === 'object'
      ? ((raw as Record<string, unknown>).user ?? (raw as Record<string, unknown>).data ?? raw)
      : raw
  )
  if (!user) {
    throw new Error('Respuesta de actualización de usuario inválida')
  }
  return user
}

/** Elimina un usuario por ID. Intenta el endpoint REST y cae al contrato con id en body. */
export async function deleteUser(userId: string): Promise<void> {
  const id = userId.trim()
  if (!id) throw new Error('ID de usuario inválido')
  try {
    await apiClient.delete(Domain.apiPath(`user/${id}/`))
  } catch (firstError) {
    try {
      await apiClient.delete(Domain.apiPath('user/'), {
        data: { id },
        skipAuthRedirect: true
      })
    } catch {
      throw firstError
    }
  }
}

export interface ResetUserPasswordPayload {
  userId: string
  new_password: string
}

export async function resetUserPassword(payload: ResetUserPasswordPayload): Promise<void> {
  const id = payload.userId.trim()
  const password = payload.new_password.trim()
  if (!id) throw new Error('ID de usuario inválido')
  if (!password) throw new Error('La contraseña temporal es obligatoria')
  try {
    await apiClient.post(
      Domain.apiPath(`user/${id}/reset-password/`),
      { new_password: password },
      {
        headers: { 'Content-Type': 'application/json' },
        skipAuthRedirect: true
      }
    )
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const apiMessage = formatApiErrorBody(e.response?.data)
      const status = e.response?.status
      if (apiMessage) throw new Error(apiMessage)
      if (status === 403) {
        throw new Error('No tienes permiso para resetear la contraseña de este usuario')
      }
      if (status && status >= 500) {
        throw new Error('El servidor falló al resetear la contraseña. Revisa la regla de permisos del backend para usuarios admin.')
      }
      throw new Error(e.message || 'Error al resetear contraseña')
    }
    throw e
  }
}
