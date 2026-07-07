// Modelos de dominio del módulo de métricas por periodo (día/semana/mes).

export type CurrencyCode = 'PEN' | 'BRL' | 'USD'

/** Granularidad temporal del panel. */
export type Granularity = 'day' | 'week' | 'month'

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
}

/** Métricas consolidadas de un periodo (period_start = inicio del bucket). */
export interface WeeklyMetricPoint {
  periodStart: string // ISO date (YYYY-MM-DD)
  enviosCount: number
  enviosVolumeOrigin: number
  clientesNuevos: number
  cajaOriginIn: number
  cajaDestinationOut: number
  cajaDiferencia: number
  facturadoDestino: number
}

/** Totales del rango completo. */
export interface WeeklyMetricsTotals {
  enviosCount: number
  enviosVolumeOrigin: number
  clientesNuevos: number
  cajaOriginIn: number
  cajaDestinationOut: number
  cajaDiferencia: number
  facturadoDestino: number
}

/** Rango y corredor efectivos devueltos por la API. */
export interface MetricsRange {
  dateFrom: string
  dateTo: string
  originCurrency: string | null
  destinationCurrency: string | null
  corridor: string
  granularity: Granularity
}

/** Respuesta consolidada del panel (una sola llamada). */
export interface WeeklyMetrics {
  range: MetricsRange
  weeks: WeeklyMetricPoint[]
  totals: WeeklyMetricsTotals
}

/** Filtros que se envían al backend. */
export interface MetricsFilters {
  dateFrom?: string | null
  dateTo?: string | null
  originCurrency: CurrencyCode
  destinationCurrency: CurrencyCode
  granularity: Granularity
  status?: string | null
  agentId?: string | null
}

export const DEFAULT_METRICS_FILTERS: MetricsFilters = {
  originCurrency: 'PEN',
  destinationCurrency: 'BRL',
  granularity: 'week',
  status: null,
  agentId: null,
}
