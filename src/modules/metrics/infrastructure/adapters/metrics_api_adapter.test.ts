import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/interface/api/client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '') }
}))

import { apiClient } from '@/interface/api/client'
import { MetricsApiAdapter } from './metrics_api_adapter'

describe('MetricsApiAdapter.getMetricsOverview', () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset())

  it('serializa filtros repetidos y normaliza todos los bloques', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        range: {
          date_from: '2026-08-01',
          date_to: '2026-08-27',
          corridor: 'Todos',
          granularity: 'week'
        },
        series: [
          {
            period_start: '2026-08-03',
            envios_count: '4',
            clientes_nuevos: 1,
            volume_origin: { PEN: '125.5' }
          }
        ],
        totals: {
          envios_count: 4,
          clientes_nuevos: 1,
          active_agents: 2,
          volume_origin: { PEN: 125.5, BRL: 20 }
        },
        breakdown_by_status: [{ key: 'completed', count: 3 }],
        breakdown_by_tag: [
          { tag_id: 't1', label: 'Cliente nuevo', color: 'emerald', active: true, count: 1 }
        ],
        breakdown_by_agent: [
          {
            agent_id: null,
            agent_name: 'Sin asesor',
            envios_count: 1,
            volume_origin: { PEN: 25 }
          }
        ]
      }
    })

    const result = await new MetricsApiAdapter().getMetricsOverview({
      corridor: 'all',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-27',
      granularity: 'week',
      status: 'completed',
      agentId: null,
      tagIds: ['t1', 't2']
    })

    const [, config] = vi.mocked(apiClient.get).mock.calls[0]!
    const params = config?.params as URLSearchParams
    expect([...params.entries()]).toEqual([
      ['corridor', 'all'],
      ['granularity', 'week'],
      ['date_from', '2026-08-01'],
      ['date_to', '2026-08-27'],
      ['status', 'completed'],
      ['tag_ids', 't1'],
      ['tag_ids', 't2']
    ])
    expect(result.series[0]?.volumeOrigin).toEqual({ PEN: 125.5, BRL: 0, USD: 0 })
    expect(result.totals.activeAgents).toBe(2)
    expect(result.breakdownByAgent[0]?.agentName).toBe('Sin asesor')
  })
})
