import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/interface/api/client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '') }
}))

import { apiClient } from '@/interface/api/client'
import { GerenciaApiAdapter } from './gerencia_api_adapter'

describe('GerenciaApiAdapter.getDashboard', () => {
  // Con llaves: si el hook devolviera el mock, vitest lo ejecutaría como cleanup.
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('envía solo los filtros informados y normaliza la respuesta', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        range: { year: 2026, date_from: '2026-01-01', date_to: '2026-12-31', corridor: 'Todos', currency: 'pen' },
        months: [
          {
            period_start: '2026-07-01',
            envios_count: '222',
            envios_by_currency: { PEN: 93, BRL: '118', USD: 11 },
            envios_by_company: { 'BRASPER 21': 24, 'INGENITECH S.A.C': '48' },
            active_clients: 172,
            new_clients: 172,
            volume_origin: { PEN: '131858.5', BRL: 233797 },
            commission_origin: { PEN: 3000, BRL: 500 },
            volume_pen_by_currency: { PEN: 131858.5, BRL: null, USD: 0 },
            volume_pen_total: null,
            revenue_pen: null,
            expenses_pen: '1200',
            net_pen: null
          }
        ],
        fx_missing: [{ month: 7, currency: 'BRL' }, { month: 13, currency: 'BRL' }],
        expenses_by_category: [{ category: 'Planilla', amount_pen: 1200, share: 100 }],
        previous_month: { period_start: '2025-12-01', active_clients: 10 },
        totals: { envios_count: 222, active_clients: 172, new_clients: 172, volume_origin: {} },
        companies: ['BRASPER 21', 'INGENITECH S.A.C'],
        top_clients: { month: 7, items: [{ user_id: 'u1', name: '', envios_count: 4 }] }
      }
    })

    const result = await new GerenciaApiAdapter().getDashboard({
      year: 2026,
      corridor: 'all',
      currency: 'PEN',
      company: null,
      status: null,
      topMonth: 7
    })

    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('metrics/management', {
      params: { year: 2026, corridor: 'all', currency: 'PEN', top_month: 7 }
    })
    expect(result.range.currency).toBe('PEN')
    expect(result.months[0]).toMatchObject({
      month: 7,
      enviosCount: 222,
      enviosByCurrency: { PEN: 93, BRL: 118, USD: 11 },
      enviosByCompany: { 'BRASPER 21': 24, 'INGENITECH S.A.C': 48 },
      volumeOrigin: { PEN: 131858.5, BRL: 233797, USD: 0 }
    })
    expect(result.months[0]).toMatchObject({
      commissionOrigin: { PEN: 3000, BRL: 500, USD: 0 },
      volumePenByCurrency: { PEN: 131858.5, BRL: null, USD: 0 },
      volumePenTotal: null,
      expensesPen: 1200,
      netPen: null
    })
    expect(result.fxMissing).toEqual([{ month: 7, currency: 'BRL' }])
    expect(result.expensesByCategory).toEqual([{ category: 'Planilla', amountPen: 1200, share: 100 }])
    expect(result.totals.expensesPen).toBe(0)
    expect(result.previousMonth?.activeClients).toBe(10)
    expect(result.topClients.items[0]?.name).toBe('Sin nombre')
  })

  it('traduce un 403 a un mensaje claro', async () => {
    const error = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403, data: {} }
    })
    vi.mocked(apiClient.get).mockRejectedValue(error)

    let caught: unknown
    try {
      await new GerenciaApiAdapter().getDashboard({
        year: 2026,
        corridor: 'all',
        currency: null,
        company: null,
        status: null,
        topMonth: null
      })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('No tienes permiso para ver el panel gerencial.')
  })
})
