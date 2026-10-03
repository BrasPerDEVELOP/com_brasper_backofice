import { describe, expect, it } from 'vitest'
import {
  monthlyChanges,
  monthlyCurrencyShares,
  monthlyRetention,
  monthsWithData,
  percentChange,
  retentionRate,
  shares
} from './calculations'
import type { ManagementMonth } from './models'

function month(partial: Partial<ManagementMonth> & { month: number }): ManagementMonth {
  return {
    periodStart: `2026-${String(partial.month).padStart(2, '0')}-01`,
    enviosCount: 0,
    enviosByCurrency: { PEN: 0, BRL: 0, USD: 0 },
    enviosByCompany: {},
    activeClients: 0,
    newClients: 0,
    volumeOrigin: { PEN: 0, BRL: 0, USD: 0 },
    commissionOrigin: { PEN: 0, BRL: 0, USD: 0 },
    volumePenByCurrency: { PEN: 0, BRL: 0, USD: 0 },
    volumePenTotal: 0,
    revenuePen: 0,
    expensesPen: 0,
    netPen: 0,
    ...partial
  }
}

describe('percentChange', () => {
  it('replica la variación de clientes activos del Excel', () => {
    expect(percentChange(526, 505)).toBe(4.2)
    expect(percentChange(548, 548)).toBe(0)
    expect(percentChange(536, 562)).toBe(-4.6)
    expect(percentChange(588, 536)).toBe(9.7)
  })

  it('devuelve null sin base de comparación', () => {
    expect(percentChange(10, 0)).toBeNull()
  })
})

describe('retentionRate', () => {
  it('replica la TRC del Excel (julio 2026)', () => {
    expect(retentionRate({ activeClients: 588, newClients: 66 }, { activeClients: 536 })).toBe(97.4)
    expect(retentionRate({ activeClients: 536, newClients: 84 }, { activeClients: 562 })).toBe(80.4)
  })

  it('no permite retención negativa ni divide por cero', () => {
    expect(retentionRate({ activeClients: 10, newClients: 20 }, { activeClients: 5 })).toBe(0)
    expect(retentionRate({ activeClients: 10, newClients: 2 }, null)).toBeNull()
    expect(retentionRate({ activeClients: 10, newClients: 2 }, { activeClients: 0 })).toBeNull()
  })
})

describe('shares', () => {
  it('replica el % de envíos por moneda (enero 2026)', () => {
    expect(shares({ PEN: 594, BRL: 636, USD: 75 })).toEqual({ PEN: 45.5, BRL: 48.7, USD: 5.7 })
  })

  it('devuelve ceros cuando no hay datos', () => {
    expect(shares({ PEN: 0, BRL: 0, USD: 0 })).toEqual({ PEN: 0, BRL: 0, USD: 0 })
  })
})

describe('series mensuales', () => {
  const months = [
    month({ month: 1, activeClients: 505, newClients: 84, enviosCount: 10 }),
    month({ month: 2, activeClients: 526, newClients: 92, enviosCount: 12 }),
    month({ month: 3, activeClients: 0, newClients: 0, enviosCount: 0 })
  ]
  const december = month({ month: 12, activeClients: 500 })

  it('usa diciembre anterior como base de enero', () => {
    expect(monthlyChanges(months, december, (m) => m.activeClients)).toEqual([1, 4.2, -100])
    expect(monthlyChanges(months, null, (m) => m.activeClients)).toEqual([null, 4.2, -100])
  })

  it('calcula la retención mes a mes', () => {
    // Enero: (505 − 84) / 500; febrero: (526 − 92) / 505.
    expect(monthlyRetention(months, december)).toEqual([84.2, 85.9, 0])
  })

  it('recorta meses futuros sin envíos', () => {
    expect(monthsWithData(months).map((m) => m.month)).toEqual([1, 2])
    expect(monthsWithData([month({ month: 1 })])).toEqual([])
  })

  it('arma las participaciones por moneda', () => {
    const result = monthlyCurrencyShares(
      [month({ month: 1, enviosByCurrency: { PEN: 1, BRL: 1, USD: 2 } })],
      (m) => m.enviosByCurrency
    )
    expect(result).toEqual({ PEN: [25], BRL: [25], USD: [50] })
  })
})
