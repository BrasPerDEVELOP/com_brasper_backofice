import { defineStore } from 'pinia'
import type { Transaction } from '../../domain/models'
import { TransactionsApiAdapter } from '../../infrastructure/adapters'

interface TransactionsState {
  transactions: Transaction[]
  isLoading: boolean
  isImporting: boolean
  error: string | null
}

export const useTransactionsStore = defineStore('transactions', {
  state: (): TransactionsState => ({
    transactions: [],
    isLoading: false,
    isImporting: false,
    error: null
  }),

  actions: {
    async loadTransactions() {
      this.isLoading = true
      this.error = null
      try {
        const repo = new TransactionsApiAdapter()
        this.transactions = await repo.getTransactions()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar transacciones'
      } finally {
        this.isLoading = false
      }
    },

    async importExcel(file: File) {
      this.isImporting = true
      this.error = null
      try {
        const repo = new TransactionsApiAdapter()
        await repo.importFromExcel(file)
        await this.loadTransactions()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al importar transacciones'
        throw e
      } finally {
        this.isImporting = false
      }
    }
  }
})
