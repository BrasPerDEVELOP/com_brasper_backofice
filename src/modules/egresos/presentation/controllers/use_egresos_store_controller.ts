import { defineStore } from 'pinia'
import axios from 'axios'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
  FxMonthRate,
  FxRateInput
} from '../../domain/models'
import { FinanceApiAdapter } from '../../infrastructure/adapters/finance_api_adapter'

let adapterSingleton: FinanceApiAdapter | null = null
function getAdapter(): FinanceApiAdapter {
  if (!adapterSingleton) adapterSingleton = new FinanceApiAdapter()
  return adapterSingleton
}

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 403) return 'No tienes permiso para esta acción.'
    const fromBody = formatApiErrorBody(e.response?.data)
    if (fromBody) return fromBody
  }
  if (e instanceof Error && e.message) return e.message
  return fallback
}

interface EgresosState {
  year: number
  /** null = todo el año */
  month: number | null
  expenses: Expense[]
  totalPen: number
  categories: ExpenseCategory[]
  fxRates: FxMonthRate[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  requestId: number
}

export const useEgresosStore = defineStore('egresos', {
  state: (): EgresosState => ({
    year: new Date().getFullYear(),
    month: null,
    expenses: [],
    totalPen: 0,
    categories: [],
    fxRates: [],
    isLoading: false,
    isSaving: false,
    error: null,
    requestId: 0
  }),

  getters: {
    categoryById:
      (state) =>
      (id: string): ExpenseCategory | undefined =>
        state.categories.find((c) => c.id === id)
  },

  actions: {
    async loadCategories() {
      if (this.categories.length) return
      try {
        this.categories = await getAdapter().getCategories()
      } catch (e) {
        this.error = errorMessage(e, 'No se pudieron cargar las categorías')
      }
    },

    async loadExpenses() {
      const reqId = ++this.requestId
      this.isLoading = true
      this.error = null
      try {
        const result = await getAdapter().getExpenses(this.year, this.month)
        if (reqId !== this.requestId) return
        this.expenses = result.items
        this.totalPen = result.totalPen
      } catch (e) {
        if (reqId !== this.requestId) return
        this.error = errorMessage(e, 'No se pudieron cargar los egresos')
      } finally {
        if (reqId === this.requestId) this.isLoading = false
      }
    },

    async setPeriod(year: number, month: number | null) {
      this.year = year
      this.month = month
      await Promise.all([this.loadExpenses(), this.loadFxRates()])
    },

    async createExpense(input: ExpenseInput): Promise<Expense> {
      this.isSaving = true
      this.error = null
      try {
        const created = await getAdapter().createExpense(input)
        await this.loadExpenses()
        return created
      } catch (e) {
        this.error = errorMessage(e, 'No se pudo registrar el egreso')
        throw e
      } finally {
        this.isSaving = false
      }
    },

    async updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
      this.isSaving = true
      this.error = null
      try {
        const updated = await getAdapter().updateExpense(id, input)
        await this.loadExpenses()
        return updated
      } catch (e) {
        this.error = errorMessage(e, 'No se pudo actualizar el egreso')
        throw e
      } finally {
        this.isSaving = false
      }
    },

    async deleteExpense(id: string) {
      this.error = null
      try {
        await getAdapter().deleteExpense(id)
        this.expenses = this.expenses.filter((e) => e.id !== id)
        this.totalPen = this.expenses.reduce((acc, e) => acc + e.amountPen, 0)
      } catch (e) {
        this.error = errorMessage(e, 'No se pudo eliminar el egreso')
        throw e
      }
    },

    async loadFxRates() {
      try {
        this.fxRates = await getAdapter().getFxRates(this.year)
      } catch (e) {
        this.error = errorMessage(e, 'No se pudieron cargar las tasas')
      }
    },

    async saveFxRates(items: FxRateInput[]) {
      this.isSaving = true
      this.error = null
      try {
        await getAdapter().saveFxRates(items)
        await this.loadFxRates()
      } catch (e) {
        this.error = errorMessage(e, 'No se pudieron guardar las tasas')
        throw e
      } finally {
        this.isSaving = false
      }
    }
  }
})
