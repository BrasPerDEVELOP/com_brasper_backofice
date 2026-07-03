// Builders puros de opciones/series para ApexCharts. Sin estado ni dependencias de Vue,
// para poder testearlos de forma aislada.
import type { Granularity, WeeklyMetricPoint } from '../../domain/models'

export interface ApexChartConfig {
  series: unknown[]
  options: Record<string, unknown>
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Etiqueta del eje X según granularidad. Robusto ante fechas vacías/inválidas.
 * - day/week: "2026-07-01" → "01 Jul"
 * - month:    "2026-07-01" → "Jul 2026"
 */
export function formatPeriodLabel(isoDate: string, granularity: Granularity = 'week'): string {
  const parts = (isoDate || '').split('-')
  if (parts.length !== 3) return isoDate || ''
  const [year, month, day] = parts
  const m = Number(month)
  if (!Number.isFinite(m) || m < 1 || m > 12) return isoDate
  if (granularity === 'month') return `${MONTHS_ES[m - 1]} ${year}`
  return `${day} ${MONTHS_ES[m - 1]}`
}

export function periodLabels(points: WeeklyMetricPoint[], granularity: Granularity = 'week'): string[] {
  return points.map((p) => formatPeriodLabel(p.periodStart, granularity))
}

type ApexChartType = 'line' | 'bar' | 'area'

function baseOptions(
  chartType: ApexChartType,
  categories: string[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    chart: {
      type: chartType,
      toolbar: { show: false },
      fontFamily: 'inherit',
      animations: { enabled: true },
    },
    dataLabels: { enabled: false },
    xaxis: { categories },
    grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'left' },
    tooltip: { shared: true },
    ...extra,
  }
}

/** Envíos por periodo: columnas (nº) + línea de volumen origen (doble eje). */
export function buildEnviosChart(weeks: WeeklyMetricPoint[], granularity: Granularity = 'week'): ApexChartConfig {
  return {
    series: [
      { name: 'Nº envíos', type: 'column', data: weeks.map((w) => w.enviosCount) },
      { name: 'Volumen origen', type: 'line', data: weeks.map((w) => round2(w.enviosVolumeOrigin)) },
    ],
    options: baseOptions('line', periodLabels(weeks, granularity), {
      stroke: { width: [0, 3], curve: 'smooth' },
      colors: ['#2563eb', '#f59e0b'],
      yaxis: [
        { title: { text: 'Nº envíos' }, labels: { formatter: (v: number) => `${Math.round(v)}` } },
        { opposite: true, title: { text: 'Volumen' }, labels: { formatter: (v: number) => compact(v) } },
      ],
    }),
  }
}

/** Clientes nuevos por periodo: línea. */
export function buildClientesChart(weeks: WeeklyMetricPoint[], granularity: Granularity = 'week'): ApexChartConfig {
  return {
    series: [{ name: 'Clientes nuevos', data: weeks.map((w) => w.clientesNuevos) }],
    options: baseOptions('line', periodLabels(weeks, granularity), {
      stroke: { width: 3, curve: 'smooth' },
      colors: ['#10b981'],
      markers: { size: 4 },
      yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}` } },
    }),
  }
}

/** Cuadre de caja: columnas agrupadas soles in vs reales out. */
export function buildCajaChart(weeks: WeeklyMetricPoint[], granularity: Granularity = 'week'): ApexChartConfig {
  return {
    series: [
      { name: 'Soles in', data: weeks.map((w) => round2(w.cajaOriginIn)) },
      { name: 'Reales out', data: weeks.map((w) => round2(w.cajaDestinationOut)) },
    ],
    options: baseOptions('bar', periodLabels(weeks, granularity), {
      plotOptions: { bar: { columnWidth: '60%' } },
      colors: ['#2563eb', '#ef4444'],
      yaxis: { labels: { formatter: (v: number) => compact(v) } },
    }),
  }
}

/** Facturado destino ("facturado Brasil"): área. */
export function buildFacturadoChart(weeks: WeeklyMetricPoint[], granularity: Granularity = 'week'): ApexChartConfig {
  return {
    series: [{ name: 'Facturado destino', data: weeks.map((w) => round2(w.facturadoDestino)) }],
    options: baseOptions('area', periodLabels(weeks, granularity), {
      stroke: { width: 2, curve: 'smooth' },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
      colors: ['#8b5cf6'],
      yaxis: { labels: { formatter: (v: number) => compact(v) } },
    }),
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Formato compacto para ejes (1.2k, 3.4M). */
export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${round2(n / 1_000_000)}M`
  if (abs >= 1_000) return `${round2(n / 1_000)}k`
  return `${round2(n)}`
}
