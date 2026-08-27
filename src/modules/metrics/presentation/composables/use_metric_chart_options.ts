import type {
  CurrencyCode,
  Granularity,
  MetricsAgentBreakdown,
  MetricsOverviewPoint
} from '../../domain/models'

export type MetricChartType = 'bar' | 'donut' | 'line'

export interface ApexChartConfig {
  series: unknown[]
  options: Record<string, unknown>
}

const MONTHS_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic'
]
const COLORS = ['#3346a8', '#08a7c7', '#13a37f', '#f59e0b', '#8b5cf6', '#ef4444']

export function formatPeriodLabel(isoDate: string, granularity: Granularity = 'week'): string {
  const parts = (isoDate || '').split('-')
  if (parts.length !== 3) return isoDate || ''
  const [year, month, day] = parts
  if (granularity === 'year') return year ?? isoDate
  const m = Number(month)
  if (!Number.isFinite(m) || m < 1 || m > 12) return isoDate
  if (granularity === 'month') return `${MONTHS_ES[m - 1]} ${year}`
  return `${day} ${MONTHS_ES[m - 1]}`
}

export function periodLabels(
  points: MetricsOverviewPoint[],
  granularity: Granularity = 'week'
): string[] {
  return points.map((point) => formatPeriodLabel(point.periodStart, granularity))
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${round2(value / 1_000_000)}M`
  if (abs >= 1_000) return `${round2(value / 1_000)}k`
  return `${round2(value)}`
}

function formatValue(value: number, money: boolean): string {
  return money
    ? value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(value).toLocaleString('es-PE')
}

function baseOptions(
  chartType: MetricChartType,
  categories: string[],
  money = false,
  horizontal = false
): Record<string, unknown> {
  return {
    chart: {
      type: chartType,
      toolbar: { show: false },
      fontFamily: 'inherit',
      animations: { enabled: true, speed: 320 }
    },
    colors: COLORS,
    dataLabels: { enabled: chartType === 'donut' },
    labels: chartType === 'donut' ? categories : undefined,
    xaxis: chartType === 'donut' ? undefined : { categories, labels: { trim: true } },
    grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
    legend: { position: 'bottom', horizontalAlign: 'left' },
    stroke: { width: chartType === 'line' ? 3 : 0, curve: 'smooth' },
    plotOptions: {
      bar: { borderRadius: 5, columnWidth: '54%', horizontal },
      pie: { donut: { size: '62%' } }
    },
    yaxis:
      chartType === 'donut'
        ? undefined
        : {
            labels: {
              formatter: (value: number) => (money ? compact(value) : `${Math.round(value)}`)
            }
          },
    tooltip: {
      shared: chartType !== 'donut',
      y: { formatter: (value: number) => formatValue(value, money) }
    },
    noData: { text: 'Sin datos para el rango seleccionado' }
  }
}

export function buildSingleSeriesChart(
  labels: string[],
  values: number[],
  seriesName: string,
  chartType: MetricChartType,
  options: { money?: boolean; horizontal?: boolean } = {}
): ApexChartConfig {
  const data = values.map(round2)
  return {
    series: chartType === 'donut' ? data : [{ name: seriesName, data }],
    options: baseOptions(chartType, labels, options.money, options.horizontal)
  }
}

export function buildPeriodCountChart(
  points: MetricsOverviewPoint[],
  granularity: Granularity,
  metric: 'envios' | 'clientes',
  chartType: MetricChartType
): ApexChartConfig {
  return buildSingleSeriesChart(
    periodLabels(points, granularity),
    points.map((point) => (metric === 'envios' ? point.enviosCount : point.clientesNuevos)),
    metric === 'envios' ? 'Envíos' : 'Clientes nuevos',
    chartType
  )
}

export function buildPeriodVolumeChart(
  points: MetricsOverviewPoint[],
  granularity: Granularity,
  currencies: CurrencyCode[],
  chartType: MetricChartType
): ApexChartConfig {
  const labels = periodLabels(points, granularity)
  if (chartType === 'donut') {
    const donutLabels = currencies.flatMap((currency) =>
      labels.map((label) => `${label} · ${currency}`)
    )
    const values = currencies.flatMap((currency) =>
      points.map((point) => point.volumeOrigin[currency])
    )
    return buildSingleSeriesChart(donutLabels, values, 'Volumen', chartType, { money: true })
  }
  return {
    series: currencies.map((currency) => ({
      name: currency,
      data: points.map((point) => round2(point.volumeOrigin[currency]))
    })),
    options: baseOptions(chartType, labels, true)
  }
}

export function buildAgentVolumeChart(
  agents: MetricsAgentBreakdown[],
  currencies: CurrencyCode[],
  chartType: MetricChartType
): ApexChartConfig {
  const labels = agents.map((agent) => agent.agentName)
  if (chartType === 'donut') {
    return buildSingleSeriesChart(
      currencies.flatMap((currency) => labels.map((label) => `${label} · ${currency}`)),
      currencies.flatMap((currency) => agents.map((agent) => agent.volumeOrigin[currency])),
      'Volumen enviado',
      chartType,
      { money: true }
    )
  }
  return {
    series: currencies.map((currency) => ({
      name: currency,
      data: agents.map((agent) => round2(agent.volumeOrigin[currency]))
    })),
    options: baseOptions(chartType, labels, true, chartType === 'bar')
  }
}
