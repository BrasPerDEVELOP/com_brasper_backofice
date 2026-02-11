import { defineStore } from 'pinia'
import type { TaxRate } from '../../domain/models'
import type { TasasRepository } from '../../infrastructure/adapters/TasasRepository'
import { TasasApiAdapter } from '../../infrastructure/adapters'
import { GetTaxRatesUseCase, UpdateTaxRateUseCase, CreateTaxRateUseCase } from '../../application/use_cases'

interface TasasState {
  taxRates: TaxRate[]
  isLoading: boolean
  error: string | null
  savingId: string | null
}

function getRepository(): TasasRepository {
  return new TasasApiAdapter()
}

export const useTasasStore = defineStore('tasas', {
  state: (): TasasState => ({
    taxRates: [],
    isLoading: false,
    error: null,
    savingId: null
  }),

  actions: {
    async loadTaxRates() {
      this.isLoading = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetTaxRatesUseCase(repo)
        this.taxRates = await useCase.execute()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar tasas'
      } finally {
        this.isLoading = false
      }
    },

    async updateTaxRate(
      id: string,
      payload: { coin_a: string; coin_b: string; tax: string }
    ) {
      this.savingId = id
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new UpdateTaxRateUseCase(repo)
        const updated = await useCase.execute(id, payload)
        const idx = this.taxRates.findIndex((r) => r.id === id)
        if (idx >= 0) this.taxRates[idx] = updated
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al guardar tasa'
      } finally {
        this.savingId = null
      }
    },

    async createTaxRate(payload: {
      coin_a: string
      coin_b: string
      tax: string
    }) {
      this.savingId = 'new'
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new CreateTaxRateUseCase(repo)
        const created = await useCase.execute(payload)
        this.taxRates.push(created)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al agregar tasa'
      } finally {
        this.savingId = null
      }
    }
  }
})
