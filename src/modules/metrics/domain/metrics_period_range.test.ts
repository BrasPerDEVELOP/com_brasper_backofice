import { describe, expect, it } from 'vitest'
import {
  dateToPeriodValue,
  normalizePeriodRange,
  periodInputType,
  periodValueToIsoDate
} from './metrics_period_range'

describe('metrics period range', () => {
  it('mantiene fechas exactas al agrupar por día', () => {
    expect(normalizePeriodRange('2026-06-15', '2026-08-16', 'day')).toEqual({
      dateFrom: '2026-06-15',
      dateTo: '2026-08-16'
    })
    expect(periodInputType('day')).toBe('date')
  })

  it('convierte una selección semanal a lunes y domingo', () => {
    expect(dateToPeriodValue('2026-08-16', 'week')).toBe('2026-W33')
    expect(periodValueToIsoDate('2026-W33', 'week', 'start')).toBe('2026-08-10')
    expect(periodValueToIsoDate('2026-W33', 'week', 'end')).toBe('2026-08-16')
    expect(periodInputType('week')).toBe('week')
  })

  it('expande meses incluyendo febrero bisiesto', () => {
    expect(periodValueToIsoDate('2024-02', 'month', 'start')).toBe('2024-02-01')
    expect(periodValueToIsoDate('2024-02', 'month', 'end')).toBe('2024-02-29')
    expect(periodInputType('month')).toBe('month')
  })

  it('expande años completos', () => {
    expect(normalizePeriodRange('2022-06-15', '2026-08-16', 'year')).toEqual({
      dateFrom: '2022-01-01',
      dateTo: '2026-12-31'
    })
    expect(periodInputType('year')).toBe('number')
  })
})
