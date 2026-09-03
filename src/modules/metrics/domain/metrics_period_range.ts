import type { Granularity } from './models'

export type PeriodRangeEdge = 'start' | 'end'
export type PeriodInputType = 'date' | 'week' | 'month' | 'number'

const DAY_MS = 86_400_000

function parseIsoDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isoWeekValue(date: Date): string {
  const target = new Date(date.getTime())
  const weekday = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - weekday)
  const weekYear = target.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${weekYear}-W${String(week).padStart(2, '0')}`
}

function weekValueToDate(value: string, edge: PeriodRangeEdge): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  if (week < 1 || week > 53) return null
  const januaryFourth = new Date(Date.UTC(year, 0, 4))
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7
  const monday = new Date(januaryFourth.getTime())
  monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthWeekday + 1 + (week - 1) * 7)
  if (isoWeekValue(monday) !== value) return null
  if (edge === 'end') monday.setUTCDate(monday.getUTCDate() + 6)
  return toIsoDate(monday)
}

export function periodInputType(granularity: Granularity): PeriodInputType {
  if (granularity === 'week') return 'week'
  if (granularity === 'month') return 'month'
  if (granularity === 'year') return 'number'
  return 'date'
}

export function dateToPeriodValue(
  value: string | null | undefined,
  granularity: Granularity
): string {
  const date = parseIsoDate(value)
  if (!date) return ''
  if (granularity === 'week') return isoWeekValue(date)
  if (granularity === 'month') return toIsoDate(date).slice(0, 7)
  if (granularity === 'year') return String(date.getUTCFullYear())
  return toIsoDate(date)
}

export function periodValueToIsoDate(
  value: string,
  granularity: Granularity,
  edge: PeriodRangeEdge
): string | null {
  if (!value) return null
  if (granularity === 'week') return weekValueToDate(value, edge)
  if (granularity === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2])
    if (month < 1 || month > 12) return null
    return edge === 'start'
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : toIsoDate(new Date(Date.UTC(year, month, 0)))
  }
  if (granularity === 'year') {
    const year = Number(value)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return null
    return `${year}-${edge === 'start' ? '01-01' : '12-31'}`
  }
  return parseIsoDate(value) ? value : null
}

export function normalizePeriodRange(
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
  granularity: Granularity
): { dateFrom: string | null; dateTo: string | null } {
  return {
    dateFrom: periodValueToIsoDate(dateToPeriodValue(dateFrom, granularity), granularity, 'start'),
    dateTo: periodValueToIsoDate(dateToPeriodValue(dateTo, granularity), granularity, 'end')
  }
}

export function singleDayPeriodRange(value: string | null | undefined): {
  dateFrom: string | null
  dateTo: string | null
} {
  const day = periodValueToIsoDate(value ?? '', 'day', 'start')
  return { dateFrom: day, dateTo: day }
}

export const PERIOD_RANGE_HINTS: Record<Granularity, string> = {
  day: 'Elige un único día; las métricas mostrarán solamente esa fecha.',
  week: 'Semanas completas: desde el lunes de la primera hasta el domingo de la última.',
  month: 'Meses completos: desde el primer día del mes inicial hasta el último del mes final.',
  year: 'Años completos: desde el 1 de enero del año inicial hasta el 31 de diciembre del final.'
}
