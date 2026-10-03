// Configuraciones ApexCharts del panel gerencial. Cada builder devuelve
// `{ series, options }` listos para <VueApexCharts>.
import {
  CURRENCY_CODES,
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  MONTH_LABELS_ES,
  type CurrencyCode,
  type ManagementMonth
} from '../../domain/models'

export interface ApexChartConfig {
  type: 'bar' | 'line'
  series: unknown[]
  options: Record<string, unknown>
}

/** Colores alineados con el Excel: soles rosa, reales turquesa, dólares amarillo. */
export const CURRENCY_COLORS: Record<CurrencyCode, string> = {
  PEN: '#ec4899',
  BRL: '#06b6d4',
  USD: '#eab308'
}
export const COMPANY_COLORS = ['#3346a8', '#ec4899', '#13a37f', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444']
const PRIMARY = '#3346a8'
const POSITIVE = '#13a37f'
const NEGATIVE = '#ef4444'

export function monthLabels(months: ManagementMonth[]): string[] {
  return months.map((m) => MONTH_LABELS_ES[m.month - 1] ?? m.periodStart)
}

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('es-PE')
}

export function formatMoney(value: number, currency: CurrencyCode, digits = 0): string {
  return `${CURRENCY_SYMBOLS[currency]} ${value.toLocaleString('es-PE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`
}

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${value.toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`
}

function baseChart(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { toolbar: { show: false }, fontFamily: 'inherit', animations: { speed: 320 }, ...extra }
}

function base(categories: string[]): Record<string, unknown> {
  return {
    chart: baseChart(),
    xaxis: { categories, labels: { trim: true, rotateAlways: false } },
    grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
    legend: { position: 'bottom', horizontalAlign: 'left' },
    noData: { text: 'Sin datos para el periodo' }
  }
}

/** Barras simples con etiqueta de valor encima (A1, B1, B3). */
export function buildCountBars(
  labels: string[],
  values: number[],
  name: string,
  color = PRIMARY
): ApexChartConfig {
  return {
    type: 'bar',
    series: [{ name, data: values }],
    options: {
      ...base(labels),
      colors: [color],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '48%', dataLabels: { position: 'top' } } },
      dataLabels: {
        enabled: true,
        offsetY: -18,
        style: { colors: ['#17213a'], fontSize: '11px', fontWeight: 700 },
        formatter: (v: number) => formatInt(v)
      },
      yaxis: { labels: { formatter: (v: number) => formatInt(v) } },
      tooltip: { y: { formatter: (v: number) => formatInt(v) } }
    }
  }
}

/** Apilado 100 % por moneda (A2, C3). `values[code][i]` ya en porcentaje. */
export function buildCurrencyShareBars(
  labels: string[],
  values: Record<CurrencyCode, number[]>
): ApexChartConfig {
  return {
    type: 'bar',
    series: CURRENCY_CODES.map((code) => ({ name: CURRENCY_LABELS[code], data: values[code] })),
    options: {
      ...base(labels),
      colors: CURRENCY_CODES.map((code) => CURRENCY_COLORS[code]),
      chart: baseChart({ stacked: true, stackType: '100%' }),
      plotOptions: { bar: { columnWidth: '46%' } },
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px', fontWeight: 700 },
        formatter: (v: number) => (v >= 4 ? `${v.toFixed(1)}%` : '')
      },
      yaxis: { max: 100, labels: { formatter: (v: number) => `${Math.round(v)}%` } },
      tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)}%` } }
    }
  }
}

/** Barras agrupadas por razón social (A3). */
export function buildCompanyBars(
  labels: string[],
  companies: string[],
  months: ManagementMonth[]
): ApexChartConfig {
  return {
    type: 'bar',
    series: companies.map((company) => ({
      name: company,
      data: months.map((m) => m.enviosByCompany[company] ?? 0)
    })),
    options: {
      ...base(labels),
      colors: COMPANY_COLORS,
      plotOptions: { bar: { borderRadius: 3, columnWidth: '70%', dataLabels: { position: 'top' } } },
      dataLabels: {
        enabled: companies.length <= 4,
        offsetY: -16,
        style: { colors: ['#17213a'], fontSize: '10px', fontWeight: 600 },
        formatter: (v: number) => (v > 0 ? formatInt(v) : '')
      },
      yaxis: { labels: { formatter: (v: number) => formatInt(v) } },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => formatInt(v) } }
    }
  }
}

/** Línea de porcentajes con huecos cuando no hay base (B2, B4). */
export function buildPercentLine(
  labels: string[],
  values: Array<number | null>,
  name: string,
  color = PRIMARY,
  options: { min?: number; max?: number } = {}
): ApexChartConfig {
  return {
    type: 'line',
    series: [{ name, data: values }],
    options: {
      ...base(labels),
      colors: [color],
      stroke: { width: 3, curve: 'straight' },
      markers: { size: 5 },
      dataLabels: {
        enabled: true,
        offsetY: -8,
        background: { enabled: false },
        style: { colors: ['#17213a'], fontSize: '11px', fontWeight: 700 },
        formatter: (v: number | null) => formatPercent(v)
      },
      yaxis: {
        min: options.min,
        max: options.max,
        labels: { formatter: (v: number) => `${v.toFixed(1)}%` }
      },
      tooltip: { y: { formatter: (v: number | null) => formatPercent(v) } }
    }
  }
}

/** Barras con signo: positivas verdes, negativas rojas (C4, D3). */
export function buildSignedBars(
  labels: string[],
  values: Array<number | null>,
  name: string,
  formatter: (v: number | null) => string = formatPercent
): ApexChartConfig {
  return {
    type: 'bar',
    series: [{ name, data: values }],
    options: {
      ...base(labels),
      colors: [
        ({ value }: { value: number | null }) => (value != null && value < 0 ? NEGATIVE : POSITIVE)
      ],
      plotOptions: { bar: { borderRadius: 3, columnWidth: '44%', dataLabels: { position: 'top' } } },
      dataLabels: {
        enabled: true,
        offsetY: -18,
        style: { colors: ['#17213a'], fontSize: '11px', fontWeight: 700 },
        formatter: (v: number | null) => formatter(v)
      },
      yaxis: { labels: { formatter: (v: number) => formatter(v) } },
      tooltip: { y: { formatter: (v: number | null) => formatter(v) } }
    }
  }
}

/** Líneas por moneda, cada una en su propia unidad (C1). */
export function buildCurrencyLines(labels: string[], months: ManagementMonth[]): ApexChartConfig {
  return {
    type: 'line',
    series: CURRENCY_CODES.map((code) => ({
      name: CURRENCY_LABELS[code],
      data: months.map((m) => Math.round(m.volumeOrigin[code]))
    })),
    options: {
      ...base(labels),
      colors: CURRENCY_CODES.map((code) => CURRENCY_COLORS[code]),
      stroke: { width: 3, curve: 'smooth' },
      markers: { size: 4 },
      dataLabels: { enabled: false },
      yaxis: { labels: { formatter: (v: number) => compact(v) } },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v: number, { seriesIndex }: { seriesIndex: number }) =>
            formatMoney(v, CURRENCY_CODES[seriesIndex] ?? 'PEN')
        }
      }
    }
  }
}

/** Barras horizontales/verticales del top de clientes (B5). */
export function buildTopClientsBars(names: string[], values: number[]): ApexChartConfig {
  const config = buildCountBars(names, values, 'Envíos', '#3b82f6')
  return {
    ...config,
    options: {
      ...config.options,
      xaxis: { categories: names, labels: { trim: true, rotate: -45, maxHeight: 110 } }
    }
  }
}

export function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`
  return `${Math.round(value)}`
}
