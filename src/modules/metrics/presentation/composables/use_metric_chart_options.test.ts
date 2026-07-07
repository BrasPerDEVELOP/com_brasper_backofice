import { describe, expect, it } from 'vitest'
import type { WeeklyMetricPoint } from '../../domain/models'
import {
  buildCajaChart,
  buildClientesChart,
  buildEnviosChart,
  buildFacturadoChart,
  compact,
  formatPeriodLabel,
  periodLabels,
} from './use_metric_chart_options'

function week(partial: Partial<WeeklyMetricPoint>): WeeklyMetricPoint {
  return {
    periodStart: '2026-06-01',
    enviosCount: 0,
    enviosVolumeOrigin: 0,
    clientesNuevos: 0,
    cajaOriginIn: 0,
    cajaDestinationOut: 0,
    cajaDiferencia: 0,
    facturadoDestino: 0,
    ...partial,
  }
}

describe('formatPeriodLabel', () => {
  it('formatea fecha ISO a "DD Mmm" (día/semana)', () => {
    expect(formatPeriodLabel('2026-07-01')).toBe('01 Jul')
    expect(formatPeriodLabel('2026-01-15', 'day')).toBe('15 Ene')
  })

  it('formatea a "Mmm YYYY" cuando la granularidad es mes', () => {
    expect(formatPeriodLabel('2026-07-01', 'month')).toBe('Jul 2026')
    expect(formatPeriodLabel('2025-12-01', 'month')).toBe('Dic 2025')
  })

  it('es robusto ante entradas inválidas', () => {
    expect(formatPeriodLabel('')).toBe('')
    expect(formatPeriodLabel('bad')).toBe('bad')
    expect(formatPeriodLabel('2026-13-01')).toBe('2026-13-01')
  })
})

describe('compact', () => {
  it('abrevia miles y millones', () => {
    expect(compact(950)).toBe('950')
    expect(compact(1500)).toBe('1.5k')
    expect(compact(2_300_000)).toBe('2.3M')
  })
})

describe('chart builders', () => {
  const weeks = [
    week({ periodStart: '2026-06-01', enviosCount: 3, enviosVolumeOrigin: 300, cajaOriginIn: 300, cajaDestinationOut: 240, facturadoDestino: 240, clientesNuevos: 2 }),
    week({ periodStart: '2026-06-08', enviosCount: 5, enviosVolumeOrigin: 500, cajaOriginIn: 500, cajaDestinationOut: 400, facturadoDestino: 400, clientesNuevos: 4 }),
  ]

  it('periodLabels mapea todos los periodos', () => {
    expect(periodLabels(weeks)).toEqual(['01 Jun', '08 Jun'])
    expect(periodLabels(weeks, 'month')).toEqual(['Jun 2026', 'Jun 2026'])
  })

  it('buildEnviosChart genera columna + línea con los datos', () => {
    const { series } = buildEnviosChart(weeks)
    expect(series).toHaveLength(2)
    expect((series[0] as { data: number[] }).data).toEqual([3, 5])
    expect((series[1] as { data: number[] }).data).toEqual([300, 500])
  })

  it('buildCajaChart agrupa soles in vs reales out', () => {
    const { series } = buildCajaChart(weeks)
    expect((series[0] as { name: string }).name).toBe('Soles in')
    expect((series[0] as { data: number[] }).data).toEqual([300, 500])
    expect((series[1] as { data: number[] }).data).toEqual([240, 400])
  })

  it('buildClientesChart y buildFacturadoChart producen una serie', () => {
    expect(buildClientesChart(weeks).series).toHaveLength(1)
    expect((buildClientesChart(weeks).series[0] as { data: number[] }).data).toEqual([2, 4])
    expect((buildFacturadoChart(weeks).series[0] as { data: number[] }).data).toEqual([240, 400])
  })
})
