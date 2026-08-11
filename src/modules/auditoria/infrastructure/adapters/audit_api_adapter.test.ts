import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/interface/api/client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '') }
}))

import { apiClient } from '@/interface/api/client'
import { AuditApiAdapter } from './audit_api_adapter'

const EVENT = {
  id: 'e1', action: 'user.delete', entity: 'user', entity_id: 'u1',
  request_id: 'r1', source: 'backoffice', success: true,
  actor_username: 'admin@brasper.com', created_at: '2026-08-10T10:00:00Z'
}

describe('AuditApiAdapter', () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset())

  it('usa URL canónica y serializa filtros/paginación', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { total: 1, items: [EVENT], skip: 0, limit: 50 } })
    const page = await new AuditApiAdapter().listEvents({ action: 'user.delete', success: true }, 0, 50)
    expect(apiClient.get).toHaveBeenCalledWith('audit/events?skip=0&limit=50&action=user.delete&success=true')
    expect(page.items[0]).toMatchObject({ id: 'e1', entity_id: 'u1', success: true })
  })

  it('carga detalle sin barra final', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: EVENT })
    await new AuditApiAdapter().getEvent('e1')
    expect(apiClient.get).toHaveBeenCalledWith('audit/events/e1')
  })

  it('no envía filtros exclusivos de cambios al listado de logins', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { total: 0, items: [], skip: 0, limit: 50 } })
    await new AuditApiAdapter().listLogins({ action: 'ignored', entity: 'ignored', source: 'www' }, 0, 50)
    expect(apiClient.get).toHaveBeenCalledWith('audit/logins?skip=0&limit=50&source=www')
  })
})
