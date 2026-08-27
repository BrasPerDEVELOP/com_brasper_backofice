import { defineStore } from 'pinia'
import {
  DEFAULT_METRICS_FILTERS,
  type MetricsAgentBreakdown,
  type MetricsFilters,
  type MetricsOverview,
  type MetricsOverviewTotals,
  type MetricsTagBreakdown,
} from '../../domain/models'
import { MetricsApiAdapter } from '../../infrastructure/adapters'
import { GetMetricsOverviewUseCase } from '../../application/use_cases/get_metrics_overview'

const EMPTY_TOTALS: MetricsOverviewTotals = {
  enviosCount: 0,
  clientesNuevos: 0,
  activeAgents: 0,
  volumeOrigin: { PEN: 0, BRL: 0, USD: 0 },
}

interface MetricsState {
  filters: MetricsFilters
  metrics: MetricsOverview | null
  availableAgents: MetricsAgentBreakdown[]
  availableTags: MetricsTagBreakdown[]
  isLoading: boolean
  error: string | null
  /** Secuencia de la última petición lanzada; descarta respuestas obsoletas. */
  requestId: number
}

export const useMetricsStore = defineStore('metrics', {
  state: (): MetricsState => ({
    filters: { ...DEFAULT_METRICS_FILTERS },
    metrics: null,
    availableAgents: [],
    availableTags: [],
    isLoading: false,
    error: null,
    requestId: 0,
  }),

  getters: {
    series: (state) => state.metrics?.series ?? [],
    totals: (state): MetricsOverviewTotals => state.metrics?.totals ?? EMPTY_TOTALS,
    corridor: (state) => state.metrics?.range.corridor ?? '',
    // Granularidad efectiva de los datos cargados (cae al filtro si aún no hay datos).
    granularity: (state) => state.metrics?.range.granularity ?? state.filters.granularity,
  },

  actions: {
    /** Aplica cambios de filtros (parciales) y recarga. */
    async applyFilters(patch: Partial<MetricsFilters>) {
      this.filters = { ...this.filters, ...patch }
      await this.loadMetricsOverview()
    },

    /** Única acción de carga: refresca todas las series del panel. */
    async loadMetricsOverview() {
      const reqId = ++this.requestId
      this.isLoading = true
      this.error = null
      try {
        const useCase = new GetMetricsOverviewUseCase(new MetricsApiAdapter())
        const result = await useCase.execute(this.filters)
        // Descarta la respuesta si entretanto se lanzó otra carga más reciente.
        if (reqId !== this.requestId) return
        this.metrics = result
        const agents = new Map(this.availableAgents.map((item) => [item.agentId, item]))
        result.breakdownByAgent.forEach((item) => agents.set(item.agentId, item))
        this.availableAgents = [...agents.values()].sort((a, b) =>
          a.agentName.localeCompare(b.agentName, 'es'),
        )
        const tags = new Map(this.availableTags.map((item) => [item.tagId, item]))
        result.breakdownByTag.forEach((item) => tags.set(item.tagId, item))
        this.availableTags = [...tags.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
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
