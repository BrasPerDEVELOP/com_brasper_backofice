import { defineStore } from 'pinia'
import { GetManagementDashboardUseCase } from '../../application/use_cases/get_management_dashboard'
import { monthsWithData } from '../../domain/calculations'
import {
  defaultManagementFilters,
  emptyCurrencyAmounts,
  type ManagementDashboard,
  type ManagementFilters,
  type ManagementMonth,
  type ManagementTotals
} from '../../domain/models'
import { GerenciaApiAdapter } from '../../infrastructure/adapters/gerencia_api_adapter'

const EMPTY_TOTALS: ManagementTotals = {
  enviosCount: 0,
  activeClients: 0,
  newClients: 0,
  volumeOrigin: emptyCurrencyAmounts(),
  volumePenTotal: null,
  revenuePen: null,
  expensesPen: 0,
  netPen: null
}

interface GerenciaState {
  filters: ManagementFilters
  dashboard: ManagementDashboard | null
  /** Razones sociales vistas en cualquier carga (para el selector del filtro). */
  availableCompanies: string[]
  isLoading: boolean
  error: string | null
  /** Secuencia de la última petición lanzada; descarta respuestas obsoletas. */
  requestId: number
}

export const useGerenciaStore = defineStore('gerencia', {
  state: (): GerenciaState => ({
    filters: defaultManagementFilters(),
    dashboard: null,
    availableCompanies: [],
    isLoading: false,
    error: null,
    requestId: 0
  }),

  getters: {
    /** Los 12 meses del año (ceros incluidos). */
    months: (state): ManagementMonth[] => state.dashboard?.months ?? [],
    /** Solo hasta el último mes con envíos: lo que se pinta en los gráficos. */
    activeMonths: (state): ManagementMonth[] => monthsWithData(state.dashboard?.months ?? []),
    previousMonth: (state): ManagementMonth | null => state.dashboard?.previousMonth ?? null,
    totals: (state): ManagementTotals => state.dashboard?.totals ?? EMPTY_TOTALS,
    hasData: (state): boolean => (state.dashboard?.totals.enviosCount ?? 0) > 0,
    topClients: (state) => state.dashboard?.topClients ?? { month: 0, items: [] },
    fxMissing: (state) => state.dashboard?.fxMissing ?? [],
    expensesByCategory: (state) => state.dashboard?.expensesByCategory ?? []
  },

  actions: {
    async applyFilters(patch: Partial<ManagementFilters>) {
      this.filters = { ...this.filters, ...patch }
      await this.load()
    },

    async resetFilters() {
      this.filters = defaultManagementFilters()
      await this.load()
    },

    async load() {
      const reqId = ++this.requestId
      this.isLoading = true
      this.error = null
      try {
        const result = await new GetManagementDashboardUseCase(new GerenciaApiAdapter()).execute(
          this.filters
        )
        if (reqId !== this.requestId) return
        this.dashboard = result
        const names = new Set([...this.availableCompanies, ...result.companies])
        this.availableCompanies = [...names].sort((a, b) => a.localeCompare(b, 'es'))
      } catch (err) {
        if (reqId !== this.requestId) return
        this.error = err instanceof Error ? err.message : 'No se pudo cargar el panel gerencial'
        this.dashboard = null
      } finally {
        if (reqId === this.requestId) this.isLoading = false
      }
    }
  }
})
