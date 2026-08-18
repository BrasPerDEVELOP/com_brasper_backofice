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
import { enrichTransactionsWithSpecialDiscountMeta, enrichTransactionWithSpecialDiscountMeta, removeTransactionSpecialDiscountMeta } from '../../infrastructure/utils/transaction_special_discount_meta'
import {
  buildDailySequenceMap,
  localDateInputStartMs,
  localDateInputEndMs
} from '../../domain/transaction_domain'

/**
 * Tamaño de página al traer el día completo. El endpoint declara `le=100`:
 * pedir más devuelve 422, así que se pagina en tandas de 100.
 */
const DAILY_SEQUENCE_PAGE_SIZE = 100

/** Corta la paginación de un día por si el backend devolviera un total absurdo. */
const DAILY_SEQUENCE_MAX_PAGES = 20

/**
 * Tope de páginas al exportar. A 100 por página son 20 000 filas, muy por
 * encima de cualquier export razonable; evita un bucle infinito si el backend
 * devolviera un `total` incoherente.
 */
const EXPORT_MAX_PAGES = 200

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
  /** Total de registros que coinciden con el filtro (paginación de servidor). */
  total: number
  /**
   * Correlativo del envío dentro de su día (`id` → `n`). Cada día reinicia en 1.
   * No se puede derivar de `transactions` porque esa es solo la página visible:
   * lo llena `loadDailySequences` trayendo el día completo.
   */
  dailySequenceById: Record<string, number>
  /** Días (`YYYY-MM-DD`) cuyo correlativo ya se resolvió, para no repedirlos. */
  loadedSequenceDays: string[]
  /**
   * Sube en cada invalidación del correlativo. La vista la observa para volver a
   * pedirlo aunque los días visibles sean los mismos que antes de guardar.
   */
  sequenceGeneration: number
  isLoading: boolean
  isRefreshing: boolean
  isImporting: boolean
  isCreating: boolean
  isUpdating: boolean
  error: string | null
  hasLoadedOnce: boolean
  /** Estado de la conexión en tiempo real */
  realtimeStatus: 'connected' | 'connecting' | 'reconnecting' | 'disconnected'
  /** Cantidad de nuevas transacciones recibidas que aún no se han insertado en la vista (por ej. en página > 1) */
  unseenRealtimeCount: number
  /** Último evento de tiempo real recibido */
  lastRealtimeEvent: {
    type: 'created' | 'updated' | 'deleted' | 'bulk_imported'
    id?: string
    timestamp: number
  } | null
}

export const useTransactionsStore = defineStore('transactions', {
  state: (): TransactionsState => ({
    transactions: [],
    total: 0,
    dailySequenceById: {},
    loadedSequenceDays: [],
    sequenceGeneration: 0,
    isLoading: false,
    isRefreshing: false,
    isImporting: false,
    isCreating: false,
    isUpdating: false,
    error: null,
    hasLoadedOnce: false,
    realtimeStatus: 'disconnected',
    unseenRealtimeCount: 0,
    lastRealtimeEvent: null
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
          const { items, total } = await useCase.execute(params)
          this.transactions = enrichTransactionsWithSpecialDiscountMeta(items)
          this.total = total
        } catch (e) {
          this.error = errorMessageFromCatch(e, 'Error al cargar transacciones')
        } finally {
          this.hasLoadedOnce = true
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

    /**
     * Resuelve el correlativo diario de los días indicados (`YYYY-MM-DD`).
     *
     * El listado viene paginado por el servidor, así que la página visible no
     * alcanza para numerar el día: se pide el día completo por `send_date` y se
     * numera con `buildDailySequenceMap`. Un día de operación son decenas de
     * registros, no miles, por eso una petición por día es suficiente.
     */
    async loadDailySequences(dayKeys: string[]) {
      const pending = Array.from(new Set(dayKeys)).filter(
        (key) => key && !this.loadedSequenceDays.includes(key)
      )
      if (pending.length === 0) return

      const repo = getTransactionsRepository()
      const useCase = new GetTransactionsUseCase(repo)

      await Promise.all(
        pending.map(async (key) => {
          const from = localDateInputStartMs(key)
          const to = localDateInputEndMs(key)
          if (from == null || to == null) return
          try {
            // Se filtra por `send_date`: un envío sin esa fecha no vuelve en esta
            // consulta y la tabla le muestra "—" en vez de un número equivocado.
            const range = {
              send_date_from: new Date(from).toISOString(),
              send_date_to: new Date(to).toISOString()
            }
            const dayItems: Transaction[] = []
            let skip = 0
            for (let page = 0; page < DAILY_SEQUENCE_MAX_PAGES; page++) {
              const { items, total } = await useCase.execute({
                ...range,
                skip,
                limit: DAILY_SEQUENCE_PAGE_SIZE
              })
              dayItems.push(...items)
              skip += DAILY_SEQUENCE_PAGE_SIZE
              if (items.length < DAILY_SEQUENCE_PAGE_SIZE || dayItems.length >= total) break
            }
            const sequence = buildDailySequenceMap(dayItems)
            const merged = { ...this.dailySequenceById }
            sequence.forEach((n, id) => {
              merged[id] = n
            })
            this.dailySequenceById = merged
            this.loadedSequenceDays = [...this.loadedSequenceDays, key]
          } catch (e) {
            // La tabla muestra "—" y sigue funcionando, pero el fallo no puede
            // quedar mudo: un 422 por parámetros inválidos se vería igual que
            // "este día no tiene envíos".
            console.error(`No se pudo numerar el día ${key}:`, e)
          }
        })
      )
    },

    /**
     * Trae TODAS las transacciones que cumplen el filtro, paginando.
     *
     * La exportación no puede quedarse con la página visible: el usuario espera
     * el mismo conjunto que anuncia el contador de resultados. No toca el
     * estado del store para no pisar la tabla mientras se descarga.
     */
    async fetchAllForExport(params?: GetTransactionsParams): Promise<Transaction[]> {
      const repo = getTransactionsRepository()
      const useCase = new GetTransactionsUseCase(repo)
      const { skip: _skip, limit: _limit, ...filters } = params ?? {}
      const all: Transaction[] = []
      let skip = 0
      for (let page = 0; page < EXPORT_MAX_PAGES; page++) {
        const { items, total } = await useCase.execute({
          ...filters,
          skip,
          limit: DAILY_SEQUENCE_PAGE_SIZE
        })
        all.push(...items)
        skip += DAILY_SEQUENCE_PAGE_SIZE
        if (items.length < DAILY_SEQUENCE_PAGE_SIZE || all.length >= total) break
      }
      return all
    },

    /** Invalida el correlativo cacheado tras crear, editar o borrar un envío. */
    resetDailySequences() {
      this.dailySequenceById = {}
      this.loadedSequenceDays = []
      this.sequenceGeneration += 1
    },

    async importExcel(file: File, filters?: GetTransactionsParams) {
      this.isImporting = true
      this.error = null
      try {
        const repo = getTransactionsRepository()
        const useCase = new ImportTransactionsFromExcelUseCase(repo)
        await useCase.execute(file)
        this.resetDailySequences()
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
        this.total += 1
        this.resetDailySequences()
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
        const enriched = enrichTransactionWithSpecialDiscountMeta(updated)
        if (idx >= 0) this.transactions[idx] = enriched
        // La fecha de envío pudo cambiar: el correlativo del día se recalcula.
        this.resetDailySequences()
        return enriched
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
        removeTransactionSpecialDiscountMeta(id)
        this.transactions = this.transactions.filter((t) => (t.id ?? '') !== id)
        this.total = Math.max(0, this.total - 1)
        this.resetDailySequences()
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
    },

    /**
     * Aplica la creación de una transacción recibida en tiempo real vía WebSocket.
     */
    applyRealtimeCreated(transaction: Transaction, options?: { prependToVisible?: boolean }) {
      const txId = transaction.id ?? ''
      const enriched = enrichTransactionWithSpecialDiscountMeta(transaction)
      const existingIdx = this.transactions.findIndex((t) => (t.id ?? '') === txId)

      if (existingIdx >= 0) {
        this.transactions[existingIdx] = enriched
      } else if (options?.prependToVisible !== false) {
        this.transactions = [enriched, ...this.transactions]
        this.total += 1
      } else {
        this.total += 1
        this.unseenRealtimeCount += 1
      }

      this.resetDailySequences()
      this.lastRealtimeEvent = {
        type: 'created',
        id: txId,
        timestamp: Date.now()
      }
    },

    /**
     * Aplica la actualización de una transacción recibida en tiempo real vía WebSocket.
     */
    applyRealtimeUpdated(transaction: Transaction) {
      const txId = transaction.id ?? ''
      const enriched = enrichTransactionWithSpecialDiscountMeta(transaction)
      const idx = this.transactions.findIndex((t) => (t.id ?? '') === txId)

      if (idx >= 0) {
        this.transactions[idx] = enriched
      }

      this.resetDailySequences()
      this.lastRealtimeEvent = {
        type: 'updated',
        id: txId,
        timestamp: Date.now()
      }
    },

    /**
     * Aplica la eliminación de una transacción recibida en tiempo real vía WebSocket.
     */
    applyRealtimeDeleted(id: string) {
      removeTransactionSpecialDiscountMeta(id)
      const had = this.transactions.some((t) => (t.id ?? '') === id)
      if (had) {
        this.transactions = this.transactions.filter((t) => (t.id ?? '') !== id)
        this.total = Math.max(0, this.total - 1)
      }
      this.resetDailySequences()
      this.lastRealtimeEvent = {
        type: 'deleted',
        id,
        timestamp: Date.now()
      }
    },

    /**
     * Notificación de importación masiva en tiempo real.
     */
    applyRealtimeBulkImported() {
      this.resetDailySequences()
      this.lastRealtimeEvent = {
        type: 'bulk_imported',
        timestamp: Date.now()
      }
    },

    setRealtimeStatus(status: 'connected' | 'connecting' | 'reconnecting' | 'disconnected') {
      this.realtimeStatus = status
    },

    incrementUnseenRealtimeCount(amount = 1) {
      this.unseenRealtimeCount += amount
    },

    clearUnseenRealtimeCount() {
      this.unseenRealtimeCount = 0
    }
  }
})
