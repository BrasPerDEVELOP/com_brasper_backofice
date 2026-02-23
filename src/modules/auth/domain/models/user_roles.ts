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
