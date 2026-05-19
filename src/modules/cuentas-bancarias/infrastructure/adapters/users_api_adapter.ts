import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'

export interface UserOption {
  id: string
  name: string
  email: string
  role?: string
}

const CLIENT_ROLE_ALIASES = ['client', 'cliente'] as const

function parseUser(item: unknown): UserOption | null {
  if (item == null || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const id = o.id ?? o.user_id
  if (id == null) return null
  const names = (o.names ?? '').toString().trim()
  const lastnames = (o.lastnames ?? '').toString().trim()
  const email = (o.email ?? o.username ?? '').toString().trim()
  const fullName = [names, lastnames].filter(Boolean).join(' ') || email || String(id)
  const role = o.role != null ? String(o.role) : undefined
  return {
    id: String(id),
    name: fullName,
    email: email || '-',
    role
  }
}

/** Usuarios con rol cliente, ordenados por nombre completo. */
export async function fetchClientUsers(): Promise<UserOption[]> {
  const byId = new Map<string, UserOption>()
  await Promise.all(
    CLIENT_ROLE_ALIASES.map(async (role) => {
      const url = Domain.apiPath('user/name-list/')
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
        if (normalizedRole && !CLIENT_ROLE_ALIASES.includes(normalizedRole as typeof CLIENT_ROLE_ALIASES[number])) {
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
      const url = Domain.apiPath('user/name-list/')
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
  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  )
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
