import { defineStore } from 'pinia'
import axios from 'axios'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
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
import type { TransactionsRepository } from '../../infrastructure/adapters/transactions_repository'

let transactionsRepositorySingleton: TransactionsRepository | null = null

function getTransactionsRepository(): TransactionsRepository {
  if (!transactionsRepositorySingleton) {
    transactionsRepositorySingleton = new TransactionsApiAdapter()
  }
  return transactionsRepositorySingleton
}

function errorMessageFromCatch(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const fromBody = formatApiErrorBody(e.response?.data)
    if (fromBody) return fromBody
    if (e.message) return e.message
  }
  if (e instanceof Error) return e.message
  return fallback
}

/** Encadena cargas para no solapar `isLoading` / `isRefreshing` entre peticiones. */
let loadTransactionsChain: Promise<void> = Promise.resolve()

export interface LoadTransactionsOptions {
  /**
   * Por defecto (undefined): si ya hay filas al ejecutar la petición, refresco en segundo plano
   * (`isRefreshing`) para no ocultar la tabla. `false` fuerza pantalla de carga (`isLoading`).
   */
  background?: boolean
}

interface TransactionsState {
  transactions: Transaction[]
  isLoading: boolean
  isRefreshing: boolean
  isImporting: boolean
  isCreating: boolean
  isUpdating: boolean
  error: string | null
}

export const useTransactionsStore = defineStore('transactions', {
  state: (): TransactionsState => ({
    transactions: [],
    isLoading: false,
    isRefreshing: false,
    isImporting: false,
    isCreating: false,
    isUpdating: false,
    error: null
  }),

  actions: {
    async loadTransactions(
      params?: GetTransactionsParams,
      options?: LoadTransactionsOptions
    ) {
      const run = async () => {
        const hadRows = this.transactions.length > 0
        const explicitBlocking = options?.background === false
        const background = hadRows && !explicitBlocking

        this.error = null
        if (background) {
          this.isRefreshing = true
        } else {
          this.isLoading = true
        }
        try {
          const repo = getTransactionsRepository()
          const useCase = new GetTransactionsUseCase(repo)
          const list = await useCase.execute(params)
          this.transactions = list
        } catch (e) {
          this.error = errorMessageFromCatch(e, 'Error al cargar transacciones')
        } finally {
          if (background) {
            this.isRefreshing = false
          } else {
            this.isLoading = false
          }
        }
      }

      const next = loadTransactionsChain.catch(() => {}).then(() => run())
      loadTransactionsChain = next
      return next
    },

    async importExcel(file: File, filters?: GetTransactionsParams) {
      this.isImporting = true
      this.error = null
      try {
        const repo = getTransactionsRepository()
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
        const repo = getTransactionsRepository()
        const useCase = new CreateTransactionUseCase(repo)
        const created = await useCase.execute(payload)
        this.transactions = [created, ...this.transactions]
        return created
      } catch (e) {
        this.error = errorMessageFromCatch(e, 'Error al crear transacción')
        throw e
      } finally {
        this.isCreating = false
      }
    },

    async updateTransaction(id: string, payload: UpdateTransactionPayload) {
      this.isUpdating = true
      this.error = null
      try {
        const repo = getTransactionsRepository()
        const useCase = new UpdateTransactionUseCase(repo)
        const updated = await useCase.execute(id, payload)
        const idx = this.transactions.findIndex((t) => (t.id ?? '') === id)
        if (idx >= 0) this.transactions[idx] = updated
        return updated
      } catch (e) {
        this.error = errorMessageFromCatch(e, 'Error al actualizar transacción')
        throw e
      } finally {
        this.isUpdating = false
      }
    },

    async deleteTransaction(id: string) {
      this.error = null
      try {
        const repo = getTransactionsRepository()
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
        const repo = getTransactionsRepository()
        return await repo.getTransactionById(id)
      } catch {
        return null
      }
    }
  }
})
