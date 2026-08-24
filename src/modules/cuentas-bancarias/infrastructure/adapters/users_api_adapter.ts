import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import { parseUserListItem, type UserIdentification } from '@modules/auth/infrastructure/parse_user'

export interface UserOption {
  id: string
  name: string
  email: string
  role?: string
  identifications: UserIdentification[]
  has_email?: boolean
  has_phone?: boolean
}

const CLIENT_ROLE_ALIASES = ['client', 'cliente'] as const

/** Proyecta la fila de usuario canónica al subconjunto que usa el selector. */
function parseUser(item: unknown): UserOption | null {
  const u = parseUserListItem(item)
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    identifications: u.identifications,
    has_email: u.has_email,
    has_phone: u.has_phone
  }
}

/** Usuarios con rol cliente, ordenados por nombre completo. */
export async function fetchClientUsers(): Promise<UserOption[]> {
  const byId = new Map<string, UserOption>()
  await Promise.all(
    CLIENT_ROLE_ALIASES.map(async (role) => {
      const url = Domain.apiPath('user/name-list')
      const response = await apiClient.get<unknown>(url, {
        params: { role },
        headers: { Accept: 'application/json' },
        skipAuthRedirect: true
      })
      const raw = response.data
      const arr = Array.isArray(raw) ? raw : extractArray(raw)
      for (const item of arr) {
        const u = parseUser(item)
        if (!u) continue
        const normalizedRole = u.role?.toLowerCase()
        if (
          normalizedRole &&
          !CLIENT_ROLE_ALIASES.includes(normalizedRole as (typeof CLIENT_ROLE_ALIASES)[number])
        ) {
          continue
        }
        if (!byId.has(u.id)) byId.set(u.id, u)
      }
    })
  )
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/**
 * Selector de usuario en transacciones (crear/editar): clientes + comercial + admin.
 * Pide `user/name-list/` por rol y unifica por `id` (sin duplicados).
 */
const TRANSACTION_FORM_USER_ROLES = [
  'client',
  'cliente',
  'commercial',
  'comercial',
  'sales',
  'admin'
] as const

export async function fetchUsersForTransactionForm(): Promise<UserOption[]> {
  const byId = new Map<string, UserOption>()
  await Promise.all(
    TRANSACTION_FORM_USER_ROLES.map(async (role) => {
      const url = Domain.apiPath('user/name-list')
      const response = await apiClient.get<unknown>(url, {
        params: { role },
        headers: { Accept: 'application/json' },
        skipAuthRedirect: true
      })
      const raw = response.data
      const arr = Array.isArray(raw) ? raw : extractArray(raw)
      for (const item of arr) {
        const u = parseUser(item)
        if (u && !byId.has(u.id)) byId.set(u.id, u)
      }
    })
  )
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Refresca las señales de completitud de un único usuario tras un evento WS. */
export async function fetchTransactionUserById(userId: string): Promise<UserOption | null> {
  const id = userId.trim()
  if (!id) return null
  const response = await apiClient.get<unknown>(Domain.apiPath('user/name-list'), {
    params: { user_id: id },
    headers: { Accept: 'application/json' },
    skipAuthRedirect: true
  })
  const raw = response.data
  const arr = Array.isArray(raw) ? raw : extractArray(raw)
  return parseUser(arr[0])
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
