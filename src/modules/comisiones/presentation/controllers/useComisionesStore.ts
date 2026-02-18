import { defineStore } from 'pinia'
import type { Commission, CommissionHistoryEntry } from '../../domain/models'
import type { ComisionesRepository, CommissionUpdateBody } from '../../infrastructure/adapters/ComisionesRepository'
import { ComisionesApiAdapter } from '../../infrastructure/adapters'
import {
  GetCommissionsUseCase,
  GetCommissionHistoryUseCase,
  CreateCommissionUseCase,
  UpdateCommissionUseCase,
  DeleteCommissionUseCase
} from '../../application/use_cases'

interface ComisionesState {
  commissions: Commission[]
  isLoading: boolean
  error: string | null
  savingId: string | null
  deletingId: string | null
  loadingHistoryId: string | null
  historyByCommissionId: Record<string, CommissionHistoryEntry[]>
}

function getRepository(): ComisionesRepository {
  return new ComisionesApiAdapter()
}

export const useComisionesStore = defineStore('comisiones', {
  state: (): ComisionesState => ({
    commissions: [],
    isLoading: false,
    error: null,
    savingId: null,
    deletingId: null,
    loadingHistoryId: null,
    historyByCommissionId: {}
  }),

  actions: {
    async loadCommissions() {
      this.isLoading = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetCommissionsUseCase(repo)
        this.commissions = await useCase.execute()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar comisiones'
      } finally {
        this.isLoading = false
      }
    },

    async createCommission(payload: {
      coin_a: string
      coin_b: string
      percentage: string
      reverse: string
      min_amount: string
      max_amount: string
    }) {
      this.savingId = 'new'
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new CreateCommissionUseCase(repo)
        const created = await useCase.execute(payload)
        this.commissions.push(created)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al crear comisión'
      } finally {
        this.savingId = null
      }
    },

    async updateCommission(id: string, body: CommissionUpdateBody) {
      this.savingId = id
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new UpdateCommissionUseCase(repo)
        const updated = await useCase.execute(id, body)
        const idx = this.commissions.findIndex((c) => c.id === id)
        if (idx >= 0) this.commissions[idx] = updated
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al actualizar comisión'
      } finally {
        this.savingId = null
      }
    },

    async deleteCommission(id: string) {
      this.deletingId = id
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new DeleteCommissionUseCase(repo)
        await useCase.execute(id)
        this.commissions = this.commissions.filter((c) => c.id !== id)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al eliminar comisión'
      } finally {
        this.deletingId = null
      }
    },

    async loadCommissionHistory(id: string, force = false) {
      if (!force && this.historyByCommissionId[id]) return
      this.loadingHistoryId = id
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetCommissionHistoryUseCase(repo)
        const history = await useCase.execute(id)
        this.historyByCommissionId = {
          ...this.historyByCommissionId,
          [id]: history
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar historial de comisión'
      } finally {
        this.loadingHistoryId = null
      }
    }
  }
})
