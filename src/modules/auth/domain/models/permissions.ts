import { USER_ROLES, type UserRole } from './user_roles'

export const PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Panel',
    permissions: [{ key: 'dashboard.view', label: 'Ver' }]
  },
  {
    key: 'metrics',
    label: 'Métricas',
    permissions: [{ key: 'metrics.view', label: 'Ver' }]
  },
  {
    key: 'users',
    label: 'Usuarios',
    permissions: [
      { key: 'users.view', label: 'Ver' },
      { key: 'users.create', label: 'Crear' },
      { key: 'users.update', label: 'Editar' },
      { key: 'users.delete', label: 'Eliminar' },
      { key: 'users.reset_password', label: 'Resetear contraseña' }
    ]
  },
  {
    key: 'roles.permissions',
    label: 'Permisos de roles',
    permissions: [
      { key: 'roles.permissions.view', label: 'Ver' },
      { key: 'roles.permissions.update', label: 'Editar' }
    ]
  },
  {
    key: 'transactions',
    label: 'Transacciones',
    permissions: [
      { key: 'transactions.view', label: 'Ver' },
      { key: 'transactions.create', label: 'Crear' },
      { key: 'transactions.update', label: 'Editar' },
      { key: 'transactions.delete', label: 'Eliminar' }
    ]
  },
  {
    key: 'accounting',
    label: 'Contabilidad',
    permissions: [{ key: 'accounting.view', label: 'Ver' }]
  },
  {
    key: 'calculator',
    label: 'Calculadora',
    permissions: [{ key: 'calculator.view', label: 'Ver' }]
  },
  {
    key: 'coupons',
    label: 'Cupones',
    permissions: [
      { key: 'coupons.view', label: 'Ver' },
      { key: 'coupons.create', label: 'Crear' },
      { key: 'coupons.update', label: 'Editar' },
      { key: 'coupons.delete', label: 'Eliminar' }
    ]
  },
  {
    key: 'bank_accounts',
    label: 'Cuentas bancarias',
    permissions: [
      { key: 'bank_accounts.view', label: 'Ver' },
      { key: 'bank_accounts.create', label: 'Crear' },
      { key: 'bank_accounts.update', label: 'Editar' },
      { key: 'bank_accounts.delete', label: 'Eliminar' }
    ]
  },
  {
    key: 'company_bank_accounts',
    label: 'Cuentas Brasper',
    permissions: [
      { key: 'company_bank_accounts.view', label: 'Ver' },
      { key: 'company_bank_accounts.create', label: 'Crear' },
      { key: 'company_bank_accounts.update', label: 'Editar' },
      { key: 'company_bank_accounts.delete', label: 'Eliminar' }
    ]
  },
  {
    key: 'commissions',
    label: 'Comisiones',
    permissions: [
      { key: 'commissions.view', label: 'Ver' },
      { key: 'commissions.create', label: 'Crear' },
      { key: 'commissions.update', label: 'Editar' },
      { key: 'commissions.delete', label: 'Eliminar' }
    ]
  },
  {
    key: 'rates',
    label: 'Tasas',
    permissions: [
      { key: 'rates.view', label: 'Ver' },
      { key: 'rates.create', label: 'Crear' },
      { key: 'rates.update', label: 'Editar' },
      { key: 'rates.delete', label: 'Eliminar' }
    ]
  },
  {
    key: 'home_banner',
    label: 'Banner Home',
    permissions: [
      { key: 'home_banner.view', label: 'Ver' },
      { key: 'home_banner.update', label: 'Editar' }
    ]
  },
  {
    key: 'blog',
    label: 'Blog',
    permissions: [
      { key: 'blog.view', label: 'Ver' },
      { key: 'blog.create', label: 'Crear' },
      { key: 'blog.update', label: 'Editar' },
      { key: 'blog.delete', label: 'Eliminar' }
    ]
  },
  {
    key: 'profile',
    label: 'Perfil',
    permissions: [
      { key: 'profile.view', label: 'Ver' },
      { key: 'profile.update', label: 'Editar perfil' },
      { key: 'profile.change_password', label: 'Cambiar contraseña' }
    ]
  }
] as const

export type PermissionKey =
  (typeof PERMISSION_MODULES)[number]['permissions'][number]['key']

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_MODULES.flatMap((module) =>
  module.permissions.map((permission) => permission.key)
)

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: ALL_PERMISSIONS,
  client: [
    'dashboard.view',
    'calculator.view',
    'profile.view',
    'profile.update',
    'profile.change_password'
  ],
  sales: [
    'dashboard.view',
    'metrics.view',
    'users.view',
    'users.create',
    'users.update',
    'bank_accounts.view',
    'bank_accounts.create',
    'bank_accounts.update',
    'transactions.view',
    'transactions.create',
    'transactions.update',
    'calculator.view',
    'coupons.view',
    'coupons.create',
    'coupons.update',
    'profile.view',
    'profile.update',
    'profile.change_password'
  ],
  accounting: [
    'dashboard.view',
    'metrics.view',
    'accounting.view',
    'transactions.view',
    'bank_accounts.view',
    'profile.view',
    'profile.update',
    'profile.change_password'
  ],
  marketing: [
    'dashboard.view',
    'coupons.view',
    'coupons.create',
    'coupons.update',
    'home_banner.view',
    'home_banner.update',
    'blog.view',
    'blog.create',
    'blog.update',
    'blog.delete',
    'profile.view',
    'profile.update',
    'profile.change_password'
  ],
  user: ['dashboard.view', 'profile.view', 'profile.update', 'profile.change_password']
}

export function isUserRole(value: string | null | undefined): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

export function getDefaultPermissionsForRole(role: string | null | undefined): PermissionKey[] {
  if (!isUserRole(role)) return DEFAULT_ROLE_PERMISSIONS.user
  return DEFAULT_ROLE_PERMISSIONS[role]
}

export function normalizePermissions(value: unknown, role?: string | null): PermissionKey[] {
  const allowed = new Set<string>(ALL_PERMISSIONS)
  const parsed = Array.isArray(value)
    ? value.filter(
        (item): item is PermissionKey => typeof item === 'string' && allowed.has(item)
      )
    : []
  return parsed.length > 0 ? parsed : getDefaultPermissionsForRole(role)
}
