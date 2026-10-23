import { describe, expect, it, vi } from 'vitest'
vi.mock('@/interface/api/client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => `/api/${path}` }
}))
import { apiClient } from '@/interface/api/client'
import { fetchUserMetrics } from './user_metrics_api_adapter'

describe('user metrics API', () => {
  it('envía el rol y conserva los agregados calculados por el servidor', async () => {
    const data = { total: 1500, brazil: 900, areas: [{ code: '11', count: 800 }] }
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data })
    expect(await fetchUserMetrics('client')).toBe(data)
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/user/metrics', {
      params: { role: 'client' },
      skipAuthRedirect: true
    })
  })
  it('consulta todos los roles sin enviar filtro vacío y propaga los errores', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Sin acceso'))
    await expect(fetchUserMetrics()).rejects.toThrow('Sin acceso')
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/user/metrics', {
      params: {},
      skipAuthRedirect: true
    })
  })
})
