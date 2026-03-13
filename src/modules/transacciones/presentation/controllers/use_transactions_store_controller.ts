import { defineStore } from 'pinia'
import type { Transaction } from '../../domain/models'
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsParams
} from '../../infrastructure/adapters/transactions_repository'
import {
  GetTransactionsUseCase,
  ImportTransactionsFromExcelUseCase,
  CreateTransactionUseCase,
  UpdateTransactionUseCase,
  DeleteTransactionUseCase
} from '../../application/use_cases'
import { TransactionsApiAdapter } from '../../infrastructure/adapters'

interface TransactionsState {
  transactions: Transaction[]
  isLoading: boolean
  isImporting: boolean
  isCreating: boolean
  isUpdating: boolean
  error: string | null
}

function getRepository() {
  return new TransactionsApiAdapter()
}

export const useTransactionsStore = defineStore('transactions', {
  state: (): TransactionsState => ({
    transactions: [],
    isLoading: false,
    isImporting: false,
    isCreating: false,
    isUpdating: false,
    error: null
  }),

  actions: {
    async loadTransactions(params?: GetTransactionsParams) {
      this.isLoading = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetTransactionsUseCase(repo)
        this.transactions = await useCase.execute(params)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar transacciones'
      } finally {
        this.isLoading = false
      }
    },

    async importExcel(file: File, filters?: GetTransactionsParams) {
      this.isImporting = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new ImportTransactionsFromExcelUseCase(repo)
        await useCase.execute(file)
        await this.loadTransactions(filters)
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('405') || msg.includes('Method Not Allowed')) {
          this.error =
            'El backend no tiene endpoint de importación (405). Prueba VITE_TRANSACTIONS_IMPORT_PATH en .env (ej. transactions/import/) o contacta al equipo backend.'
        } else {
          this.error = msg || 'Error al importar transacciones'
        }
        throw e
      } finally {
        this.isImporting = false
      }
    },

    async createTransaction(payload: CreateTransactionPayload) {
      this.isCreating = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new CreateTransactionUseCase(repo)
        const created = await useCase.execute(payload)
        this.transactions = [created, ...this.transactions]
        return created
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al crear transacción'
        throw e
      } finally {
        this.isCreating = false
      }
    },

    async updateTransaction(id: string, payload: UpdateTransactionPayload) {
      this.isUpdating = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new UpdateTransactionUseCase(repo)
        const updated = await useCase.execute(id, payload)
        const idx = this.transactions.findIndex((t) => (t.id ?? '') === id)
        if (idx >= 0) this.transactions[idx] = updated
        return updated
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al actualizar transacción'
        throw e
      } finally {
        this.isUpdating = false
      }
    },

    async deleteTransaction(id: string) {
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new DeleteTransactionUseCase(repo)
        await useCase.execute(id)
        this.transactions = this.transactions.filter((t) => (t.id ?? '') !== id)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al eliminar transacción'
        throw e
      }
    },

    async getTransactionById(id: string): Promise<Transaction | null> {
      try {
        const repo = getRepository()
        return await repo.getTransactionById(id)
      } catch {
        return null
      }
    }
  }
})
