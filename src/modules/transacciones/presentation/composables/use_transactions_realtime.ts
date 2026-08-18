import { ref, computed, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import { useTransactionsStore } from '../controllers/use_transactions_store_controller'
import { TransactionsRealtimeClient } from '../../infrastructure/realtime/transactions_realtime_client'
import type { Transaction } from '../../domain/models'
import type { GetTransactionsParams } from '../../infrastructure/adapters/transactions_repository'

export interface UseTransactionsRealtimeOptions {
  currentPage?: Ref<number>
  getFilters?: () => GetTransactionsParams
  onRefresh?: () => void | Promise<void>
  autoConnect?: boolean
}

/**
 * Evalúa si una transacción cumple los filtros actualmente aplicados en la vista.
 */
export function matchesCurrentFilters(
  tx: Transaction,
  filters?: GetTransactionsParams
): boolean {
  if (!filters) return true

  // Filtro por estado
  if (filters.status && filters.status !== 'todos' && filters.status !== 'all') {
    const txStatus = (tx.status ?? '').toLowerCase()
    const targetStatus = filters.status.toLowerCase()
    if (txStatus !== targetStatus) return false
  }

  // Filtro por usuario / cliente
  const clientObj = (tx.client && typeof tx.client === 'object') ? (tx.client as Record<string, unknown>) : undefined
  const userObj = (tx.user && typeof tx.user === 'object') ? (tx.user as Record<string, unknown>) : undefined
  const txUserId = String(tx.user_id ?? clientObj?.id ?? userObj?.id ?? '')
  if (filters.user_id && txUserId !== String(filters.user_id)) {
    return false
  }

  // Filtro por fecha de creación desde
  if (filters.created_at_from && tx.created_at) {
    const txDate = new Date(tx.created_at).getTime()
    const fromDate = new Date(filters.created_at_from).getTime()
    if (!Number.isNaN(txDate) && !Number.isNaN(fromDate) && txDate < fromDate) {
      return false
    }
  }

  // Filtro por fecha de creación hasta
  if (filters.created_at_to && tx.created_at) {
    const txDate = new Date(tx.created_at).getTime()
    const toDate = new Date(filters.created_at_to).getTime()
    if (!Number.isNaN(txDate) && !Number.isNaN(toDate) && txDate > toDate) {
      return false
    }
  }

  // Filtro por fecha de envío desde
  if (filters.send_date_from && tx.send_date) {
    const txDate = new Date(tx.send_date).getTime()
    const fromDate = new Date(filters.send_date_from).getTime()
    if (!Number.isNaN(txDate) && !Number.isNaN(fromDate) && txDate < fromDate) {
      return false
    }
  }

  // Filtro por fecha de envío hasta
  if (filters.send_date_to && tx.send_date) {
    const txDate = new Date(tx.send_date).getTime()
    const toDate = new Date(filters.send_date_to).getTime()
    if (!Number.isNaN(txDate) && !Number.isNaN(toDate) && txDate > toDate) {
      return false
    }
  }

  // Filtro por texto / búsqueda
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    const code = String(tx.transaction_code ?? tx.code ?? '').toLowerCase()
    const clientName = String(clientObj?.full_name ?? userObj?.full_name ?? tx.company_name ?? '').toLowerCase()
    const id = String(tx.id ?? '').toLowerCase()
    if (!code.includes(q) && !clientName.includes(q) && !id.includes(q)) {
      return false
    }
  }

  return true
}

export function useTransactionsRealtime(options?: UseTransactionsRealtimeOptions) {
  const authStore = useAuthStore()
  const transactionsStore = useTransactionsStore()

  const highlightedTxIds = ref<Set<string>>(new Set())
  const highlightTimers = new Map<string, ReturnType<typeof setTimeout>>()

  let client: TransactionsRealtimeClient | null = null

  const isConnected = computed(() => transactionsStore.realtimeStatus === 'connected')
  const isReconnecting = computed(() => transactionsStore.realtimeStatus === 'reconnecting')
  const unseenCount = computed(() => transactionsStore.unseenRealtimeCount)
  const realtimeStatus = computed(() => transactionsStore.realtimeStatus)

  function triggerHighlight(txId: string, durationMs = 3500) {
    if (!txId) return
    const existing = highlightTimers.get(txId)
    if (existing) clearTimeout(existing)

    const updated = new Set(highlightedTxIds.value)
    updated.add(txId)
    highlightedTxIds.value = updated

    const timer = setTimeout(() => {
      const current = new Set(highlightedTxIds.value)
      current.delete(txId)
      highlightedTxIds.value = current
      highlightTimers.delete(txId)
    }, durationMs)

    highlightTimers.set(txId, timer)
  }

  function isTxHighlighted(id?: string): boolean {
    return id ? highlightedTxIds.value.has(id) : false
  }

  /** Recarga la página actual: el callback de la vista, o el store en segundo plano. */
  function refresh() {
    if (options?.onRefresh) {
      options.onRefresh()
      return
    }
    transactionsStore.loadTransactions(options?.getFilters?.(), { background: true })
  }

  function connect() {
    if (client) return

    client = new TransactionsRealtimeClient(() => authStore.token)

    client.connect({
      onStatusChange: (status) => {
        transactionsStore.setRealtimeStatus(status)
      },
      onReconnect: () => {
        refresh()
      },
      onCreated: (tx) => {
        const filters = options?.getFilters?.()
        const matches = matchesCurrentFilters(tx, filters)
        const isFirstPage = (options?.currentPage?.value ?? 1) === 1

        if (matches && isFirstPage) {
          transactionsStore.applyRealtimeCreated(tx, { prependToVisible: true })
          if (tx.id) triggerHighlight(tx.id)
        } else {
          // Si no coincide o estamos en página > 1, solo se incrementa el contador
          transactionsStore.applyRealtimeCreated(tx, { prependToVisible: false })
        }
      },
      onUpdated: (tx) => {
        transactionsStore.applyRealtimeUpdated(tx)
        if (tx.id) triggerHighlight(tx.id)
      },
      onDeleted: (id) => {
        transactionsStore.applyRealtimeDeleted(id)
      },
      onBulkImported: () => {
        transactionsStore.applyRealtimeBulkImported()
        refresh()
      },
      onPartial: (id) => {
        // Sin la fila completa sólo podemos recargar; el highlight se mantiene
        // para que el operador vea qué cambió.
        if (id) triggerHighlight(id)
        refresh()
      }
    })
  }

  function disconnect() {
    if (client) {
      client.disconnect()
      client = null
    }
    transactionsStore.setRealtimeStatus('disconnected')

    for (const timer of highlightTimers.values()) {
      clearTimeout(timer)
    }
    highlightTimers.clear()
    highlightedTxIds.value = new Set()
  }

  if (options?.autoConnect !== false) {
    onMounted(() => {
      connect()
    })

    onBeforeUnmount(() => {
      disconnect()
    })
  }

  return {
    isConnected,
    isReconnecting,
    realtimeStatus,
    unseenCount,
    highlightedTxIds,
    isTxHighlighted,
    connect,
    disconnect,
    clearUnseenCount: () => transactionsStore.clearUnseenRealtimeCount()
  }
}
