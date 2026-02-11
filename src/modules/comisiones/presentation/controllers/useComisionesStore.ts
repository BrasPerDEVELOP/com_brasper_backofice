import { defineStore } from 'pinia'
import type { Commission } from '../../domain/models'
import type { ComisionesRepository } from '../../infrastructure/adapters/ComisionesRepository'
import { ComisionesApiAdapter } from '../../infrastructure/adapters'
import { GetCommissionsUseCase } from '../../application/use_cases'

interface ComisionesState {
  commissions: Commission[]
  isLoading: boolean
  error: string | null
}

function getRepository(): ComisionesRepository {
  return new ComisionesApiAdapter()
}

export const useComisionesStore = defineStore('comisiones', {
  state: (): ComisionesState => ({
    commissions: [],
    isLoading: false,
    error: null
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
    }
  }
})
