import { describe, expect, it } from 'vitest'
import type { MetricsOverviewPoint } from '../../domain/models'
import {
  buildPeriodCountChart,
  buildPeriodVolumeChart,
  buildSingleSeriesChart,
  compact,
  formatPeriodLabel,
  periodLabels
} from './use_metric_chart_options'

const points: MetricsOverviewPoint[] = [
  {
    periodStart: '2026-06-01',
    enviosCount: 3,
    clientesNuevos: 2,
    volumeOrigin: { PEN: 300, BRL: 20, USD: 0 }
  },
  {
    periodStart: '2026-06-08',
    enviosCount: 5,
    clientesNuevos: 4,
    volumeOrigin: { PEN: 500, BRL: 40, USD: 10 }
  }
]

describe('formatPeriodLabel', () => {
  it('formatea día, semana y mes en español', () => {
    expect(formatPeriodLabel('2026-07-01')).toBe('01 Jul')
    expect(formatPeriodLabel('2025-12-01', 'month')).toBe('Dic 2025')
    expect(formatPeriodLabel('2025-01-01', 'year')).toBe('2025')
    expect(formatPeriodLabel('bad')).toBe('bad')
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
  it('mapea periodos y conteos', () => {
    expect(periodLabels(points)).toEqual(['01 Jun', '08 Jun'])
    expect(
      (buildPeriodCountChart(points, 'week', 'envios', 'bar').series[0] as { data: number[] }).data
    ).toEqual([3, 5])
  })

  it('separa el volumen por moneda sin sumar monedas incompatibles', () => {
    const result = buildPeriodVolumeChart(points, 'week', ['PEN', 'BRL'], 'line')
    expect(result.series).toHaveLength(2)
    expect((result.series[0] as { name: string }).name).toBe('PEN')
    expect((result.series[1] as { data: number[] }).data).toEqual([20, 40])
  })

  it('convierte una serie a dona con etiquetas equivalentes', () => {
    const result = buildSingleSeriesChart(['A', 'B'], [2, 3], 'Estados', 'donut')
    expect(result.series).toEqual([2, 3])
    expect(result.options.labels).toEqual(['A', 'B'])
  })
})
