import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import {
  USER_ROLES,
  getDefaultPermissionsForRole,
  isUserRole,
  normalizePermissions,
  type PermissionKey,
  type UserRole
} from '../../domain/models'

export interface RolePermissions {
  role: UserRole
  permissions: PermissionKey[]
}

function parseRolePermissions(item: unknown): RolePermissions | null {
  if (item == null || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const role = String(o.role ?? '')
  if (!isUserRole(role)) return null
  return {
    role,
    permissions: normalizePermissions(o.permissions, role) as PermissionKey[]
  }
}

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw != null && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const arr = obj.data ?? obj.results ?? obj.items ?? obj.roles
    if (Array.isArray(arr)) return arr
  }
  return []
}

export function getDefaultRolePermissions(): RolePermissions[] {
  return USER_ROLES.map((role) => ({
    role,
    permissions: getDefaultPermissionsForRole(role)
  }))
}

export async function fetchRolePermissions(): Promise<RolePermissions[]> {
  const response = await apiClient.get<unknown>(Domain.apiPath('roles/permissions'), {
    headers: { Accept: 'application/json' },
    skipAuthRedirect: true
  })
  const parsed = extractArray(response.data)
    .map(parseRolePermissions)
    .filter((item): item is RolePermissions => item != null)
  const byRole = new Map(parsed.map((item) => [item.role, item.permissions]))
  return USER_ROLES.map((role) => ({
    role,
    permissions: byRole.get(role) ?? getDefaultPermissionsForRole(role)
  }))
}

export async function updateRolePermissions(
  role: UserRole,
  permissions: PermissionKey[]
): Promise<RolePermissions> {
  const response = await apiClient.put<unknown>(
    Domain.apiPath(`roles/${role}/permissions`),
    { permissions },
    {
      headers: { 'Content-Type': 'application/json' },
      skipAuthRedirect: true
    }
  )
  return (
    parseRolePermissions(
      response.data != null && typeof response.data === 'object'
        ? ((response.data as Record<string, unknown>).data ??
            (response.data as Record<string, unknown>).role_permissions ??
            response.data)
        : response.data
    ) ?? { role, permissions }
  )
}
