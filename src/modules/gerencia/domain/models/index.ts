// Modelos de dominio del panel gerencial (agregados mensuales de un año).
// Contrato: GET /metrics/management (snake_case) → camelCase aquí.

export type CurrencyCode = 'PEN' | 'BRL' | 'USD'
export const CURRENCY_CODES: readonly CurrencyCode[] = ['PEN', 'BRL', 'USD']

/** Etiquetas de moneda tal como las usa gerencia en el Excel. */
export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  PEN: 'Soles',
  BRL: 'Reales',
  USD: 'Dólares'
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  PEN: 'S/',
  BRL: 'R$',
  USD: '$'
}

export type CurrencyCounts = Record<CurrencyCode, number>
export type CurrencyAmounts = Record<CurrencyCode, number>

export type ManagementCorridor = 'all' | 'PEN_BRL' | 'BRL_PEN' | 'USD_BRL' | 'BRL_USD'

export interface ManagementMonth {
  /** ISO date del día 1 del mes (YYYY-MM-01). */
  periodStart: string
  /** 1..12 */
  month: number
  enviosCount: number
  enviosByCurrency: CurrencyCounts
  enviosByCompany: Record<string, number>
  activeClients: number
  newClients: number
  volumeOrigin: CurrencyAmounts
  /** Comisión cobrada (ingreso bruto) en moneda de origen. */
  commissionOrigin: CurrencyAmounts
  /** En soles con la tasa mensual registrada; `null` si falta la tasa. */
  volumePenByCurrency: Record<CurrencyCode, number | null>
  volumePenTotal: number | null
  revenuePen: number | null
  /** Egresos del mes en soles. */
  expensesPen: number
  netPen: number | null
}

export interface ManagementFxMissing {
  month: number
  currency: CurrencyCode
}

export interface ManagementExpenseCategory {
  category: string
  amountPen: number
  share: number
}

export interface ManagementTopClient {
  userId: string
  name: string
  enviosCount: number
}

export interface ManagementTotals {
  enviosCount: number
  activeClients: number
  newClients: number
  volumeOrigin: CurrencyAmounts
  volumePenTotal: number | null
  revenuePen: number | null
  expensesPen: number
  netPen: number | null
}

export interface ManagementRange {
  year: number
  dateFrom: string
  dateTo: string
  corridor: string
  currency: CurrencyCode | null
  company: string | null
  status: string | null
}

export interface ManagementDashboard {
  range: ManagementRange
  /** Siempre 12 entradas, enero → diciembre. */
  months: ManagementMonth[]
  /** Diciembre del año anterior (para la variación de enero). */
  previousMonth: ManagementMonth | null
  totals: ManagementTotals
  companies: string[]
  topClients: { month: number; items: ManagementTopClient[] }
  /** Meses con envíos en una moneda sin tasa a soles registrada. */
  fxMissing: ManagementFxMissing[]
  /** Egresos por categoría del mes de `topClients.month`. */
  expensesByCategory: ManagementExpenseCategory[]
}

/** Filtros que se envían al backend. */
export interface ManagementFilters {
  year: number
  corridor: ManagementCorridor
  currency: CurrencyCode | null
  company: string | null
  status: string | null
  /** Mes del top de clientes (null = último mes con envíos). */
  topMonth: number | null
}

export const MONTH_LABELS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
] as const

export function currentYear(): number {
  return new Date().getFullYear()
}

export function defaultManagementFilters(): ManagementFilters {
  return {
    year: currentYear(),
    corridor: 'all',
    currency: null,
    company: null,
    status: null,
    topMonth: null
  }
}

export function emptyCurrencyCounts(): CurrencyCounts {
  return { PEN: 0, BRL: 0, USD: 0 }
}

export function emptyCurrencyAmounts(): CurrencyAmounts {
  return { PEN: 0, BRL: 0, USD: 0 }
}
