/** Roles de usuario (alineados con backend UserRole). */
export const USER_ROLES = [
  'user',
  'sales',
  'admin',
  'client',
  'marketing',
  'accounting'
] as const

export type UserRole = (typeof USER_ROLES)[number]

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  user: 'Usuario',
  sales: 'Ventas',
  admin: 'Admin',
  client: 'Cliente',
  marketing: 'Marketing',
  accounting: 'Contabilidad'
}

/** Alinea el rol del backend con `USER_ROLES` (minúsculas) para comparaciones y permisos por defecto. */
export function normalizeStoredRole(role: unknown): string | null {
  if (role == null) return null
  const s = String(role).trim()
  if (!s) return null
  const lower = s.toLowerCase()
  if (USER_ROLES.includes(lower as UserRole)) return lower
  return s
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeStoredRole(role) === 'admin'
}

export function isAccountingRole(role: string | null | undefined): boolean {
  return normalizeStoredRole(role) === 'accounting'
}
