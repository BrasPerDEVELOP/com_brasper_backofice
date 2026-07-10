// Fase B (B3) — Parsers canónicos de usuario desde respuestas del backend.
// Unifica la lógica de alias (español/inglés, snake/camel) que antes estaba
// duplicada en auth_api_adapter, users_management_api_adapter y (cuentas)
// users_api_adapter. El comportamiento es idéntico al previo.

import { type User, normalizePermissions, normalizeStoredRole } from '../domain/models'

/**
 * Fila ligera de usuario para listados/selectores (GET /user/, name-list).
 * Rol en crudo (no normalizado) para preservar labels de la tabla de usuarios.
 */
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

/**
 * Parsea el usuario completo (dominio) desde login / GET /user/{id}.
 * Normaliza rol y permisos. Devuelve `null` si el payload no es un usuario.
 */
export function parseUser(data: unknown): User | null {
  if (data === null || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const id = o.id ?? o.user_id
  if (id == null) return null
  const names = o.names != null ? String(o.names) : null
  const lastnames = o.lastnames != null ? String(o.lastnames) : null
  const email = (o.email ?? o.username) != null ? String(o.email ?? o.username) : ''
  const displayName = [names, lastnames].filter(Boolean).join(' ') || email
  const phoneVal = o.phone ?? o.telefono
  const phone =
    typeof phoneVal === 'number'
      ? phoneVal
      : typeof phoneVal === 'string' && phoneVal
        ? Number(phoneVal)
        : null
  const documentType = o.document_type ?? o.documentType ?? o.tipo_documento
  const codePhone = o.code_phone ?? o.codePhone ?? o.codigo_telefono
  const roleNorm = normalizeStoredRole(o.role)
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
    role: roleNorm,
    phone: Number.isFinite(phone) ? phone : null,
    code_phone: codePhone != null ? String(codePhone) : null,
    permissions: normalizePermissions(o.permissions, roleNorm),
    must_change_password: Boolean(o.must_change_password)
  }
}

/**
 * Parsea una fila de listado/selector. Mantiene el rol en crudo y aplica los
 * fallbacks de nombre/email de los listados (`email || '-'`, `name || id`).
 */
export function parseUserListItem(item: unknown): UserListItem | null {
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
