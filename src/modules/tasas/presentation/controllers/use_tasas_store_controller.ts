import { defineStore } from 'pinia'
import type { TaxRate, TaxRateHistoryEntry } from '../../domain/models'
import type { TasasRepository } from '../../infrastructure/adapters/tasas_repository'
import { TasasApiAdapter } from '../../infrastructure/adapters'
import {
  GetTaxRatesUseCase,
  GetTaxRateHistoryUseCase,
  UpdateTaxRateUseCase,
  CreateTaxRateUseCase,
  DeleteTaxRateUseCase
} from '../../application/use_cases'

interface TasasState {
  taxRates: TaxRate[]
  isLoading: boolean
  error: string | null
  savingId: string | null
  deletingId: string | null
  loadingHistoryId: string | null
  historyByTaxRateId: Record<string, TaxRateHistoryEntry[]>
}

function getRepository(): TasasRepository {
  return new TasasApiAdapter()
}

export const useTasasStore = defineStore('tasas', {
  state: (): TasasState => ({
    taxRates: [],
    isLoading: false,
    error: null,
    savingId: null,
    deletingId: null,
    loadingHistoryId: null,
    historyByTaxRateId: {}
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
    },

    async deleteTaxRate(id: string) {
      this.deletingId = id
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new DeleteTaxRateUseCase(repo)
        await useCase.execute(id)
        this.taxRates = this.taxRates.filter((rate) => rate.id !== id)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al eliminar tasa'
      } finally {
        this.deletingId = null
      }
    },

    async loadTaxRateHistory(id: string, force = false) {
      if (!force && this.historyByTaxRateId[id]) return
      this.loadingHistoryId = id
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetTaxRateHistoryUseCase(repo)
        const history = await useCase.execute(id)
        this.historyByTaxRateId = {
          ...this.historyByTaxRateId,
          [id]: history
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar historial de tasa'
      } finally {
        this.loadingHistoryId = null
      }
    },

    /**
     * Valida la tasa y actualiza. El controlador centraliza la validación
     * para evitar mutaciones directas del estado desde las vistas.
     * @returns true si se guardó correctamente (sin error)
     */
    async validateAndUpdateTaxRate(
      id: string,
      taxValue: number,
      coinA: string,
      coinB: string
    ): Promise<boolean> {
      if (Number.isNaN(taxValue) || taxValue <= 0) {
        this.error = 'Ingresa una tasa válida mayor a 0.'
        return false
      }
      await this.updateTaxRate(id, {
        coin_a: coinA,
        coin_b: coinB,
        tax: String(taxValue)
      })
      return !this.error
    }
  }
})
