import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { AuditEvent, AuditFilters, AuditPage, LoginEvent } from '../../domain/models'

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function nullableString(value: unknown): string | null {
  return value == null || value === '' ? null : String(value)
}

function parseAuditEvent(value: unknown): AuditEvent | null {
  const item = objectOrEmpty(value)
  if (!item.id || !item.action || !item.entity || !item.request_id) return null
  return {
    id: String(item.id),
    actor_user_id: nullableString(item.actor_user_id),
    actor_username: nullableString(item.actor_username),
    actor_role: nullableString(item.actor_role),
    action: String(item.action),
    entity: String(item.entity),
    entity_id: nullableString(item.entity_id),
    description: nullableString(item.description),
    old_values: item.old_values != null ? objectOrEmpty(item.old_values) : null,
    new_values: item.new_values != null ? objectOrEmpty(item.new_values) : null,
    source: String(item.source ?? ''),
    ip_address: nullableString(item.ip_address),
    user_agent: nullableString(item.user_agent),
    method: nullableString(item.method),
    path: nullableString(item.path),
    status_code: typeof item.status_code === 'number' ? item.status_code : null,
    request_id: String(item.request_id),
    success: item.success !== false,
    metadata: item.metadata != null ? objectOrEmpty(item.metadata) : null,
    created_at: String(item.created_at ?? '')
  }
}

function parseLoginEvent(value: unknown): LoginEvent | null {
  const item = objectOrEmpty(value)
  if (!item.id || !item.request_id) return null
  return {
    id: String(item.id),
    user_id: nullableString(item.user_id),
    attempted_username: nullableString(item.attempted_username),
    success: item.success === true,
    failure_reason: nullableString(item.failure_reason),
    ip_address: nullableString(item.ip_address),
    user_agent: nullableString(item.user_agent),
    browser: nullableString(item.browser),
    os: nullableString(item.os),
    device: nullableString(item.device),
    source: String(item.source ?? ''),
    request_id: String(item.request_id),
    session_id: nullableString(item.session_id),
    created_at: String(item.created_at ?? '')
  }
}

function queryString(filters: AuditFilters, skip: number, limit: number): string {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

function parsePage<T>(raw: unknown, parser: (value: unknown) => T | null): AuditPage<T> {
  const page = objectOrEmpty(raw)
  const rawItems = Array.isArray(page.items) ? page.items : []
  return {
    total: Number(page.total ?? 0),
    items: rawItems.map(parser).filter((item): item is T => item !== null),
    skip: Number(page.skip ?? 0),
    limit: Number(page.limit ?? 50)
  }
}

export class AuditApiAdapter {
  async listEvents(filters: AuditFilters, skip: number, limit: number): Promise<AuditPage<AuditEvent>> {
    const url = `${Domain.apiPath('audit/events')}?${queryString(filters, skip, limit)}`
    const response = await apiClient.get<unknown>(url)
    return parsePage(response.data, parseAuditEvent)
  }

  async getEvent(id: string): Promise<AuditEvent> {
    const response = await apiClient.get<unknown>(Domain.apiPath(`audit/events/${id}`))
    const event = parseAuditEvent(response.data)
    if (!event) throw new Error('Respuesta de auditoría inválida')
    return event
  }

  async listLogins(filters: AuditFilters, skip: number, limit: number): Promise<AuditPage<LoginEvent>> {
    const loginFilters = { ...filters }
    delete loginFilters.action
    delete loginFilters.entity
    delete loginFilters.search
    const url = `${Domain.apiPath('audit/logins')}?${queryString(loginFilters, skip, limit)}`
    const response = await apiClient.get<unknown>(url)
    return parsePage(response.data, parseLoginEvent)
  }
}
