// Modelos de dominio del módulo de métricas por periodo (día/semana/mes/año).

export type CurrencyCode = 'PEN' | 'BRL' | 'USD'
export type CurrencyAmounts = Record<CurrencyCode, number>
export type MetricsCorridor = 'all' | 'PEN_BRL' | 'BRL_PEN' | 'USD_BRL' | 'BRL_USD'

export const METRICS_CORRIDORS: ReadonlyArray<{ value: MetricsCorridor; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'PEN_BRL', label: 'PEN → BRL' },
  { value: 'BRL_PEN', label: 'BRL → PEN' },
  { value: 'USD_BRL', label: 'USD → BRL' },
  { value: 'BRL_USD', label: 'BRL → USD' }
]

/** Granularidad temporal del panel. */
export type Granularity = 'day' | 'week' | 'month' | 'year'

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año'
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

export interface MetricsOverviewPoint {
  periodStart: string
  enviosCount: number
  clientesNuevos: number
  volumeOrigin: CurrencyAmounts
}

export interface MetricsOverviewTotals {
  enviosCount: number
  clientesNuevos: number
  activeAgents: number
  volumeOrigin: CurrencyAmounts
}

export interface MetricsStatusBreakdown {
  key: string
  count: number
}

export interface MetricsTagBreakdown {
  tagId: string
  label: string
  color: string
  active: boolean
  count: number
}

export interface MetricsAgentBreakdown {
  agentId: string | null
  agentName: string
  enviosCount: number
  volumeOrigin: CurrencyAmounts
}

export interface MetricsOverview {
  range: MetricsRange
  series: MetricsOverviewPoint[]
  totals: MetricsOverviewTotals
  breakdownByStatus: MetricsStatusBreakdown[]
  breakdownByTag: MetricsTagBreakdown[]
  breakdownByAgent: MetricsAgentBreakdown[]
}

/** Filtros que se envían al backend. */
export interface MetricsFilters {
  dateFrom?: string | null
  dateTo?: string | null
  corridor: MetricsCorridor
  granularity: Granularity
  status?: string | null
  agentId?: string | null
  tagIds: string[]
}

/** Filtros del endpoint legado `/metrics/weekly`. */
export interface WeeklyMetricsFilters {
  dateFrom?: string | null
  dateTo?: string | null
  originCurrency: CurrencyCode
  destinationCurrency: CurrencyCode
  granularity: Granularity
  status?: string | null
  agentId?: string | null
}

export const DEFAULT_METRICS_FILTERS: MetricsFilters = {
  corridor: 'all',
  granularity: 'week',
  status: null,
  agentId: null,
  tagIds: []
}
