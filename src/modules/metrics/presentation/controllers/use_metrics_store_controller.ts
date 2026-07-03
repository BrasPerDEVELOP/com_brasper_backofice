import { defineStore } from 'pinia'
import {
  DEFAULT_METRICS_FILTERS,
  type MetricsFilters,
  type WeeklyMetrics,
  type WeeklyMetricsTotals,
} from '../../domain/models'
import { MetricsApiAdapter } from '../../infrastructure/adapters'
import { GetWeeklyMetricsUseCase } from '../../application/use_cases/get_weekly_metrics'

const EMPTY_TOTALS: WeeklyMetricsTotals = {
  enviosCount: 0,
  enviosVolumeOrigin: 0,
  clientesNuevos: 0,
  cajaOriginIn: 0,
  cajaDestinationOut: 0,
  cajaDiferencia: 0,
  facturadoDestino: 0,
}

interface MetricsState {
  filters: MetricsFilters
  metrics: WeeklyMetrics | null
  isLoading: boolean
  error: string | null
  /** Secuencia de la última petición lanzada; descarta respuestas obsoletas. */
  requestId: number
}

export const useMetricsStore = defineStore('metrics', {
  state: (): MetricsState => ({
    filters: { ...DEFAULT_METRICS_FILTERS },
    metrics: null,
    isLoading: false,
    error: null,
    requestId: 0,
  }),

  getters: {
    weeks: (state) => state.metrics?.weeks ?? [],
    totals: (state): WeeklyMetricsTotals => state.metrics?.totals ?? EMPTY_TOTALS,
    corridor: (state) => state.metrics?.range.corridor ?? '',
    // Granularidad efectiva de los datos cargados (cae al filtro si aún no hay datos).
    granularity: (state) => state.metrics?.range.granularity ?? state.filters.granularity,
  },

  actions: {
    /** Aplica cambios de filtros (parciales) y recarga. */
    async applyFilters(patch: Partial<MetricsFilters>) {
      this.filters = { ...this.filters, ...patch }
      await this.loadWeeklyMetrics()
    },

    /** Única acción de carga: refresca todas las series del panel. */
    async loadWeeklyMetrics() {
      const reqId = ++this.requestId
      this.isLoading = true
      this.error = null
      try {
        const useCase = new GetWeeklyMetricsUseCase(new MetricsApiAdapter())
        const result = await useCase.execute(this.filters)
        // Descarta la respuesta si entretanto se lanzó otra carga más reciente.
        if (reqId !== this.requestId) return
        this.metrics = result
      } catch (err) {
        if (reqId !== this.requestId) return
        this.error = err instanceof Error ? err.message : 'No se pudieron cargar las métricas'
        this.metrics = null
      } finally {
        // Solo la última petición controla el estado de carga.
        if (reqId === this.requestId) this.isLoading = false
      }
    },
  },
})
