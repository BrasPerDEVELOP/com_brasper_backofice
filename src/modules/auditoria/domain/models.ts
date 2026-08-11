export interface AuditEvent {
  id: string
  actor_user_id: string | null
  actor_username: string | null
  actor_role: string | null
  action: string
  entity: string
  entity_id: string | null
  description: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  source: string
  ip_address: string | null
  user_agent: string | null
  method: string | null
  path: string | null
  status_code: number | null
  request_id: string
  success: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface LoginEvent {
  id: string
  user_id: string | null
  attempted_username: string | null
  success: boolean
  failure_reason: string | null
  ip_address: string | null
  user_agent: string | null
  browser: string | null
  os: string | null
  device: string | null
  source: string
  request_id: string
  session_id: string | null
  created_at: string
}

export interface AuditPage<T> {
  total: number
  items: T[]
  skip: number
  limit: number
}

export interface AuditFilters {
  search?: string
  action?: string
  entity?: string
  source?: string
  ip_address?: string
  success?: boolean
  created_from?: string
  created_to?: string
}
