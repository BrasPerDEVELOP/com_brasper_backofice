import axios from 'axios'
import { apiClient } from '@/interface/api/client'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import { Domain } from '@/interface/infrastructure/services'
import {
  CURRENCY_CODES,
  emptyCurrencyAmounts,
  emptyCurrencyCounts,
  type CurrencyAmounts,
  type CurrencyCode,
  type CurrencyCounts,
  type ManagementDashboard,
  type ManagementExpenseCategory,
  type ManagementFilters,
  type ManagementFxMissing,
  type ManagementMonth,
  type ManagementTopClient
} from '../../domain/models'
import type { GerenciaRepository } from './gerencia_repository'

const ENDPOINT = 'metrics/management'

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function currencyCode(value: unknown): CurrencyCode | null {
  const code = str(value).toUpperCase()
  return (CURRENCY_CODES as readonly string[]).includes(code) ? (code as CurrencyCode) : null
}

function parseCurrencyCounts(value: unknown): CurrencyCounts {
  const raw = record(value)
  const result = emptyCurrencyCounts()
  for (const code of CURRENCY_CODES) result[code] = Math.round(num(raw[code]))
  return result
}

function parseCurrencyAmounts(value: unknown): CurrencyAmounts {
  const raw = record(value)
  const result = emptyCurrencyAmounts()
  for (const code of CURRENCY_CODES) result[code] = num(raw[code])
  return result
}

function nullableNum(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function parseNullableCurrencyAmounts(value: unknown): Record<CurrencyCode, number | null> {
  const raw = record(value)
  const result = { PEN: null, BRL: null, USD: null } as Record<CurrencyCode, number | null>
  for (const code of CURRENCY_CODES) result[code] = nullableNum(raw[code])
  return result
}

function parseCompanyCounts(value: unknown): Record<string, number> {
  const raw = record(value)
  const result: Record<string, number> = {}
  for (const [name, count] of Object.entries(raw)) result[name] = Math.round(num(count))
  return result
}

function parseMonth(raw: Record<string, unknown>): ManagementMonth {
  const periodStart = str(raw.period_start)
  const monthNumber = Number(periodStart.split('-')[1])
  return {
    periodStart,
    month: Number.isFinite(monthNumber) && monthNumber >= 1 && monthNumber <= 12 ? monthNumber : 0,
    enviosCount: Math.round(num(raw.envios_count)),
    enviosByCurrency: parseCurrencyCounts(raw.envios_by_currency),
    enviosByCompany: parseCompanyCounts(raw.envios_by_company),
    activeClients: Math.round(num(raw.active_clients)),
    newClients: Math.round(num(raw.new_clients)),
    volumeOrigin: parseCurrencyAmounts(raw.volume_origin),
    commissionOrigin: parseCurrencyAmounts(raw.commission_origin),
    volumePenByCurrency: parseNullableCurrencyAmounts(raw.volume_pen_by_currency),
    volumePenTotal: nullableNum(raw.volume_pen_total),
    revenuePen: nullableNum(raw.revenue_pen),
    expensesPen: num(raw.expenses_pen),
    netPen: nullableNum(raw.net_pen)
  }
}

function parseFxMissing(raw: Record<string, unknown>): ManagementFxMissing | null {
  const currency = currencyCode(raw.currency)
  const month = Math.round(num(raw.month))
  return currency && month >= 1 && month <= 12 ? { month, currency } : null
}

function parseExpenseCategory(raw: Record<string, unknown>): ManagementExpenseCategory {
  return {
    category: str(raw.category) || 'Sin categoría',
    amountPen: num(raw.amount_pen),
    share: num(raw.share)
  }
}

function parseTopClient(raw: Record<string, unknown>): ManagementTopClient {
  return {
    userId: str(raw.user_id),
    name: str(raw.name) || 'Sin nombre',
    enviosCount: Math.round(num(raw.envios_count))
  }
}

function toReadableError(err: unknown): Error {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (status === 404) {
      return new Error(`El endpoint gerencial (${ENDPOINT}) no está disponible en el backend (404).`)
    }
    if (status === 403) return new Error('No tienes permiso para ver el panel gerencial.')
    const body = formatApiErrorBody(err.response?.data)
    if (body) return new Error(body)
    if (status) return new Error(`El servidor respondió con estado ${status}.`)
    if (err.code === 'ERR_NETWORK') return new Error('No se pudo conectar con el servidor.')
  }
  return err instanceof Error ? err : new Error('No se pudo cargar el panel gerencial')
}

/** Adaptador HTTP: GET /metrics/management → modelos de dominio. */
export class GerenciaApiAdapter implements GerenciaRepository {
  private endpoint(): string {
    return Domain.apiPath(ENDPOINT)
  }

  async getDashboard(filters: ManagementFilters): Promise<ManagementDashboard> {
    const params: Record<string, string | number> = {
      year: filters.year,
      corridor: filters.corridor
    }
    if (filters.currency) params.currency = filters.currency
    if (filters.company) params.company = filters.company
    if (filters.status) params.status = filters.status
    if (filters.topMonth) params.top_month = filters.topMonth

    let response
    try {
      response = await apiClient.get<unknown>(this.endpoint(), { params })
    } catch (err) {
      throw toReadableError(err)
    }
    const data = record(response.data)
    const range = record(data.range)
    const totals = record(data.totals)
    const top = record(data.top_clients)
    const previous = data.previous_month ? parseMonth(record(data.previous_month)) : null

    return {
      range: {
        year: Math.round(num(range.year)) || filters.year,
        dateFrom: str(range.date_from),
        dateTo: str(range.date_to),
        corridor: str(range.corridor),
        currency: currencyCode(range.currency),
        company: range.company == null ? null : str(range.company),
        status: range.status == null ? null : str(range.status)
      },
      months: records(data.months).map(parseMonth),
      previousMonth: previous,
      totals: {
        enviosCount: Math.round(num(totals.envios_count)),
        activeClients: Math.round(num(totals.active_clients)),
        newClients: Math.round(num(totals.new_clients)),
        volumeOrigin: parseCurrencyAmounts(totals.volume_origin),
        volumePenTotal: nullableNum(totals.volume_pen_total),
        revenuePen: nullableNum(totals.revenue_pen),
        expensesPen: num(totals.expenses_pen),
        netPen: nullableNum(totals.net_pen)
      },
      companies: Array.isArray(data.companies) ? data.companies.map(str).filter(Boolean) : [],
      topClients: {
        month: Math.round(num(top.month)),
        items: records(top.items).map(parseTopClient)
      },
      fxMissing: records(data.fx_missing)
        .map(parseFxMissing)
        .filter((item): item is ManagementFxMissing => item !== null),
      expensesByCategory: records(data.expenses_by_category).map(parseExpenseCategory)
    }
  }
}
