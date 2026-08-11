import axios from 'axios'
import { apiClient } from '@/interface/api/client'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import { Domain } from '@/interface/infrastructure/services'
import { USER_ROLES } from '../../domain/models'
import {
  isClientProfileIncomplete,
  parseUserListItem,
  type UserIdentification,
  type UserListItem
} from '../parse_user'

export { USER_ROLES }
// Re-exportado para no romper importadores existentes (usuarios_view, transacciones).
export type { UserIdentification, UserListItem }

export const DEFAULT_USER_TEMPORARY_PASSWORD = 'Pass123!'

const parseUser = parseUserListItem

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
  const url = Domain.apiPath('user')
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
  const usersById = new Map<string, UserListItem>()
  for (const item of arr) {
    const user = parseUser(item)
    if (!user) continue
    const current = usersById.get(user.id)
    if (!current || userCompletenessScore(user) > userCompletenessScore(current)) {
      usersById.set(user.id, user)
    }
  }
  return Array.from(usersById.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/**
 * Si el API repite un mismo id (por ejemplo, al expandir relaciones), conserva
 * la representación con más datos en vez de pintar dos filas del mismo usuario.
 */
function userCompletenessScore(user: UserListItem): number {
  return (
    (user.email !== '-' ? 1 : 0) +
    (user.names ? 1 : 0) +
    (user.lastnames ? 1 : 0) +
    (user.phone != null ? 1 : 0) +
    user.identifications.length * 2
  )
}

/** @deprecated Use fetchUsers instead. */
export async function fetchAllUsers(): Promise<UserListItem[]> {
  return fetchUsers()
}

/**
 * Obtiene el detalle canónico de un usuario para precargar el formulario de
 * edición con la colección COMPLETA de identificaciones. Intenta `GET
 * /user/{id}/` y, si el endpoint de detalle no existe todavía, cae al listado
 * filtrado por id para no romper la edición durante la transición del backend.
 */
export async function fetchUserById(id: string): Promise<UserListItem | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const response = await apiClient.get<unknown>(Domain.apiPath(`user/${trimmed}`), {
      headers: { Accept: 'application/json' },
      skipAuthRedirect: true
    })
    const raw = response.data
    const payload =
      raw != null && typeof raw === 'object'
        ? ((raw as Record<string, unknown>).user ?? (raw as Record<string, unknown>).data ?? raw)
        : raw
    const detail = parseUser(Array.isArray(payload) ? payload[0] : payload)
    if (detail) return detail
  } catch {
    // El endpoint de detalle puede no existir aún: caemos al listado filtrado por id.
  }
  // Solo el usuario con el id exacto: si el backend ignora el filtro user_id,
  // devolver filtered[0] hidrataría identificaciones de OTRO usuario y al
  // guardar se sobrescribirían las del usuario editado.
  const filtered = await fetchUsers({ user_id: trimmed })
  return filtered.find((u) => u.id === trimmed) ?? null
}

export interface CreateUserPayload {
  email?: string
  names?: string
  lastnames?: string
  role?: string
  password?: string
  document_number?: string
  document_type?: string
  identifications?: UserIdentification[]
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
  if (payload.identifications !== undefined) {
    form.append('identifications', JSON.stringify(payload.identifications))
  }
  const phoneVal = payload.phone
  const phoneNum =
    phoneVal != null && phoneVal !== ''
      ? (typeof phoneVal === 'number' ? phoneVal : Number(phoneVal))
      : null
  if (phoneNum != null && Number.isFinite(phoneNum)) form.append('phone', String(phoneNum))
  if (payload.code_phone?.trim()) form.append('code_phone', payload.code_phone.trim())
  if (payload.profile_image instanceof File) form.append('profile_image', payload.profile_image)
}

function normalizeEmail(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function isDuplicateEmailApiError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const status = err.response?.status
  if (status !== 400 && status !== 409 && status !== 422) return false
  const data = err.response?.data
  if (data != null && typeof data === 'object' && 'email' in (data as Record<string, unknown>)) {
    return true
  }
  const msg = (formatApiErrorBody(data) ?? '').toLowerCase()
  return (
    msg.includes('email') &&
    (msg.includes('exist') ||
      msg.includes('ya ') ||
      msg.includes('duplic') ||
      msg.includes('unique') ||
      msg.includes('registrado') ||
      msg.includes('taken'))
  )
}

/** Busca un usuario por correo (insensible a mayúsculas). */
export async function findUserByEmail(
  email: string,
  role?: string | null
): Promise<UserListItem | null> {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const match = (list: UserListItem[]) =>
    list.find((u) => {
      const candidate = normalizeEmail(u.email === '-' ? '' : u.email)
      return candidate === normalized
    }) ?? null

  if (role?.trim()) {
    const byRole = await fetchUsers({ role: role.trim() })
    const hit = match(byRole)
    if (hit) return hit
  }
  return match(await fetchUsers())
}

const createUserInflight = new Map<string, Promise<UserListItem>>()

function createUserRequestKey(payload: CreateUserPayload): string {
  const image = payload.profile_image
  return JSON.stringify({
    email: normalizeEmail(payload.email),
    names: payload.names?.trim().toLowerCase() ?? '',
    lastnames: payload.lastnames?.trim().toLowerCase() ?? '',
    role: payload.role?.trim().toLowerCase() ?? '',
    password: payload.password?.trim() ?? DEFAULT_USER_TEMPORARY_PASSWORD,
    document_number: payload.document_number?.replace(/\s+/g, '').toLowerCase() ?? '',
    document_type: payload.document_type?.trim().toLowerCase() ?? '',
    identifications: (payload.identifications ?? []).map((item) => ({
      document_type: item.document_type.trim().toLowerCase(),
      document_number: item.document_number.replace(/\s+/g, '').toLowerCase(),
      is_primary: item.is_primary
    })),
    phone: payload.phone == null ? '' : String(payload.phone).trim(),
    code_phone: payload.code_phone?.trim() ?? '',
    image:
      image instanceof File
        ? `${image.name}:${image.size}:${image.type}:${image.lastModified}`
        : ''
  })
}

async function postUser(payload: CreateUserPayload): Promise<UserListItem> {
  const url = Domain.apiPath('user')
  const form = new FormData()
  appendUserFormFields(form, {
    ...payload,
    password: payload.password?.trim() || DEFAULT_USER_TEMPORARY_PASSWORD
  })

  try {
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
  } catch (e) {
    const email = payload.email?.trim()
    if (email && isDuplicateEmailApiError(e)) {
      const existing = await findUserByEmail(email, payload.role)
      if (existing) return existing
    }
    if (axios.isAxiosError(e)) {
      const apiMessage = formatApiErrorBody(e.response?.data)
      if (apiMessage) throw new Error(apiMessage)
    }
    throw e instanceof Error ? e : new Error('Error al crear usuario')
  }
}

function normalizePersonName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isClientCreation(payload: CreateUserPayload): boolean {
  return ['client', 'cliente'].includes(payload.role?.trim().toLowerCase() ?? '')
}

function completesProfile(payload: CreateUserPayload): boolean {
  return Boolean(
    payload.email?.trim() ||
      payload.document_number?.trim() ||
      payload.identifications?.some((item) => item.document_number.trim())
  )
}

function phonesAreCompatible(user: UserListItem, payload: CreateUserPayload): boolean {
  if (user.phone == null || payload.phone == null || payload.phone === '') return true
  return String(user.phone).trim() === String(payload.phone).trim()
}

async function findIncompleteClientToComplete(
  payload: CreateUserPayload
): Promise<UserListItem | null> {
  if (!isClientCreation(payload) || !completesProfile(payload)) return null

  const requestedName = normalizePersonName(
    [payload.names, payload.lastnames].filter(Boolean).join(' ')
  )
  if (!requestedName) return null

  const candidates = (await fetchUsers({ role: 'client' })).filter(
    (user) =>
      isClientProfileIncomplete(user) &&
      normalizePersonName(user.name) === requestedName &&
      phonesAreCompatible(user, payload)
  )
  if (candidates.length > 1) {
    throw new Error(
      'Hay más de un cliente incompleto con ese nombre. Edita el perfil correcto para evitar duplicados.'
    )
  }
  return candidates[0] ?? null
}

async function createOrCompleteUser(payload: CreateUserPayload): Promise<UserListItem> {
  const incompleteClient = await findIncompleteClientToComplete(payload)
  if (!incompleteClient) return postUser(payload)

  return updateUser({
    id: incompleteClient.id,
    email: payload.email,
    names: payload.names,
    lastnames: payload.lastnames,
    role: payload.role,
    document_number: payload.document_number,
    document_type: payload.document_type,
    identifications: payload.identifications,
    profile_image: payload.profile_image,
    phone: payload.phone,
    code_phone: payload.code_phone
  })
}

/**
 * Crea un usuario con semántica single-flight: llamadas concurrentes con el
 * mismo payload comparten un único POST y reciben la misma respuesta.
 */
export function createUser(payload: CreateUserPayload): Promise<UserListItem> {
  const key = createUserRequestKey(payload)
  const pending = createUserInflight.get(key)
  if (pending) return pending

  const request = createOrCompleteUser(payload).finally(() => {
    if (createUserInflight.get(key) === request) createUserInflight.delete(key)
  })
  createUserInflight.set(key, request)
  return request
}

/** Actualiza un usuario. PUT /user/ (multipart/form-data con id). */
export async function updateUser(payload: UpdateUserPayload): Promise<UserListItem> {
  const url = Domain.apiPath('user')
  const form = new FormData()
  form.append('id', payload.id)
  appendUserFormFields(form, payload)

  try {
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
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const apiMessage = formatApiErrorBody(e.response?.data)
      if (apiMessage) throw new Error(apiMessage)
      if (!e.response) {
        throw new Error(
          'El servidor no respondió (posible error interno del API). Intenta de nuevo o revisa el backend.'
        )
      }
    }
    throw e instanceof Error ? e : new Error('Error al actualizar usuario')
  }
}

/**
 * Elimina un usuario por ID.
 *
 * La ruta del backend es `DELETE /user/{id}` **sin barra final**. Con la barra,
 * FastAPI responde 307 hacia la misma URL sin ella; el proxy la reescribe a
 * HTTP y el navegador bloquea el DELETE por contenido mixto, así que el borrado
 * fallaba siempre. Es la misma trampa ya documentada en el adaptador de
 * transacciones.
 *
 * Se conserva el intento con el id en el cuerpo como respaldo para despliegues
 * antiguos que exponían ese contrato.
 */
export async function deleteUser(userId: string): Promise<void> {
  const id = userId.trim()
  if (!id) throw new Error('ID de usuario inválido')
  try {
    await apiClient.delete(Domain.apiPath(`user/${id}`))
  } catch (firstError) {
    try {
      await apiClient.delete(Domain.apiPath('user'), {
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
      Domain.apiPath(`user/${id}/reset-password`),
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
