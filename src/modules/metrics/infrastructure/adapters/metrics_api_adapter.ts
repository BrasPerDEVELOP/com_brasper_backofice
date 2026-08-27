import axios from 'axios'
import { apiClient } from '@/interface/api/client'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import { env } from '@/interface/config/env'
import { Domain } from '@/interface/infrastructure/services'
import type {
  Granularity,
  MetricsFilters,
  MetricsAgentBreakdown,
  MetricsOverview,
  MetricsOverviewPoint,
  MetricsRange,
  MetricsStatusBreakdown,
  MetricsTagBreakdown,
  WeeklyMetricPoint,
  WeeklyMetrics,
  WeeklyMetricsFilters,
  WeeklyMetricsTotals,
} from '../../domain/models'
import type { MetricsRepository } from './metrics_repository'

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function parseWeek(raw: Record<string, unknown>): WeeklyMetricPoint {
  return {
    periodStart: str(raw.period_start ?? raw.week_start),
    enviosCount: num(raw.envios_count),
    enviosVolumeOrigin: num(raw.envios_volume_origin),
    clientesNuevos: num(raw.clientes_nuevos),
    cajaOriginIn: num(raw.caja_origin_in),
    cajaDestinationOut: num(raw.caja_destination_out),
    cajaDiferencia: num(raw.caja_diferencia),
    facturadoDestino: num(raw.facturado_destino),
  }
}

function parseTotals(raw: Record<string, unknown> | undefined): WeeklyMetricsTotals {
  const t = raw ?? {}
  return {
    enviosCount: num(t.envios_count),
    enviosVolumeOrigin: num(t.envios_volume_origin),
    clientesNuevos: num(t.clientes_nuevos),
    cajaOriginIn: num(t.caja_origin_in),
    cajaDestinationOut: num(t.caja_destination_out),
    cajaDiferencia: num(t.caja_diferencia),
    facturadoDestino: num(t.facturado_destino),
  }
}

function parseGranularity(value: unknown): Granularity {
  return value === 'day' || value === 'month' ? value : 'week'
}

function parseRange(raw: Record<string, unknown> | undefined): MetricsRange {
  const r = raw ?? {}
  return {
    dateFrom: str(r.date_from),
    dateTo: str(r.date_to),
    originCurrency: r.origin_currency == null ? null : str(r.origin_currency),
    destinationCurrency: r.destination_currency == null ? null : str(r.destination_currency),
    corridor: str(r.corridor),
    granularity: parseGranularity(r.granularity),
  }
}

function parseCurrencyAmounts(value: unknown) {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return { PEN: num(raw.PEN), BRL: num(raw.BRL), USD: num(raw.USD) }
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : []
}

function parseOverviewPoint(raw: Record<string, unknown>): MetricsOverviewPoint {
  return {
    periodStart: str(raw.period_start),
    enviosCount: num(raw.envios_count),
    clientesNuevos: num(raw.clientes_nuevos),
    volumeOrigin: parseCurrencyAmounts(raw.volume_origin),
  }
}

function parseAgent(raw: Record<string, unknown>): MetricsAgentBreakdown {
  return {
    agentId: raw.agent_id == null ? null : str(raw.agent_id),
    agentName: str(raw.agent_name) || 'Sin asesor',
    enviosCount: num(raw.envios_count),
    volumeOrigin: parseCurrencyAmounts(raw.volume_origin),
  }
}

function parseTag(raw: Record<string, unknown>): MetricsTagBreakdown {
  return {
    tagId: str(raw.tag_id),
    label: str(raw.label),
    color: str(raw.color) || 'slate',
    active: raw.active !== false,
    count: num(raw.count),
  }
}

function parseStatus(raw: Record<string, unknown>): MetricsStatusBreakdown {
  return { key: str(raw.key), count: num(raw.count) }
}

/** Convierte un error de axios en un mensaje legible y accionable. */
function toReadableError(err: unknown, endpoint: string): Error {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (status === 404) {
      return new Error(`El endpoint de métricas (${endpoint}) no está disponible en el backend (404).`)
    }
    const body = formatApiErrorBody(err.response?.data)
    if (body) return new Error(body)
    if (status) return new Error(`El servidor respondió con estado ${status}.`)
    if (err.code === 'ERR_NETWORK') return new Error('No se pudo conectar con el servidor.')
  }
  return err instanceof Error ? err : new Error('No se pudieron cargar las métricas')
}

/** Adaptador HTTP: llama a GET /metrics/weekly y normaliza a modelos de dominio. */
export class MetricsApiAdapter implements MetricsRepository {
  // Ruta configurable vía VITE_METRICS_WEEKLY_PATH (por defecto: metrics/weekly).
  private endpoint(): string {
    return Domain.apiPath(env.metricsWeeklyPath)
  }

  private overviewEndpoint(): string {
    return Domain.apiPath(env.metricsOverviewPath)
  }

  async getMetricsOverview(filters: MetricsFilters): Promise<MetricsOverview> {
    const params = new URLSearchParams()
    params.set('corridor', filters.corridor)
    params.set('granularity', filters.granularity)
    if (filters.dateFrom) params.set('date_from', filters.dateFrom)
    if (filters.dateTo) params.set('date_to', filters.dateTo)
    if (filters.status) params.set('status', filters.status)
    if (filters.agentId) params.set('agent_id', filters.agentId)
    filters.tagIds.forEach((tagId) => params.append('tag_ids', tagId))

    let response
    try {
      response = await apiClient.get<unknown>(this.overviewEndpoint(), { params })
    } catch (err) {
      throw toReadableError(err, this.overviewEndpoint())
    }
    const data = (response.data ?? {}) as Record<string, unknown>
    const totals = (data.totals ?? {}) as Record<string, unknown>
    return {
      range: parseRange(data.range as Record<string, unknown> | undefined),
      series: records(data.series).map(parseOverviewPoint),
      totals: {
        enviosCount: num(totals.envios_count),
        clientesNuevos: num(totals.clientes_nuevos),
        activeAgents: num(totals.active_agents),
        volumeOrigin: parseCurrencyAmounts(totals.volume_origin),
      },
      breakdownByStatus: records(data.breakdown_by_status).map(parseStatus),
      breakdownByTag: records(data.breakdown_by_tag).map(parseTag),
      breakdownByAgent: records(data.breakdown_by_agent).map(parseAgent),
    }
  }

  async getWeeklyMetrics(filters: WeeklyMetricsFilters): Promise<WeeklyMetrics> {
    const params: Record<string, string> = {
      origin_currency: filters.originCurrency,
      destination_currency: filters.destinationCurrency,
      granularity: filters.granularity,
    }
    if (filters.dateFrom) params.date_from = filters.dateFrom
    if (filters.dateTo) params.date_to = filters.dateTo
    if (filters.status) params.status = filters.status
    if (filters.agentId) params.agent_id = filters.agentId

    let response
    try {
      response = await apiClient.get<unknown>(this.endpoint(), { params })
    } catch (err) {
      throw toReadableError(err, this.endpoint())
    }
    const data = (response.data ?? {}) as Record<string, unknown>
    const weeksRaw = Array.isArray(data.weeks) ? (data.weeks as Record<string, unknown>[]) : []

    return {
      range: parseRange(data.range as Record<string, unknown> | undefined),
      weeks: weeksRaw.map(parseWeek),
      totals: parseTotals(data.totals as Record<string, unknown> | undefined),
    }
  }
}
