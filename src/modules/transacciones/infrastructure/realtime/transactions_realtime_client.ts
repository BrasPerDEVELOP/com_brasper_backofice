import { WebSocketService } from '@/interface/infrastructure/services/websocket_service'
import type { WebSocketStatus } from '@/interface/infrastructure/services/websocket_service'
import { Domain } from '@/interface/infrastructure/services/domain'
import { refreshAccessToken } from '@/interface/api/client'
import { transactionFromApiRecord } from '../mappers/parse_transaction'
import type { Transaction } from '../../domain/models'

export type RealtimeTransactionEventType =
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_UPDATED'
  | 'TRANSACTION_DELETED'
  | 'TRANSACTIONS_BULK_IMPORTED'
  | 'CLIENT_DATA_STATUS_UPDATED'

export interface RealtimeActor {
  id?: string
  name?: string
  username?: string
}

export interface RealtimeTransactionEvent {
  event: RealtimeTransactionEventType
  transaction?: Transaction
  transactionId?: string
  actor?: RealtimeActor
  timestamp?: string
  count?: number
}

export interface TransactionsRealtimeCallbacks {
  onCreated?: (transaction: Transaction, actor?: RealtimeActor) => void
  onUpdated?: (transaction: Transaction, actor?: RealtimeActor) => void
  onDeleted?: (transactionId: string, actor?: RealtimeActor) => void
  onBulkImported?: (count?: number) => void
  onClientDataStatusUpdated?: (userId: string) => void
  /**
   * El evento llegó recortado (replicado entre procesos con un payload que no
   * cabía en `NOTIFY`): trae el id pero no la fila completa, así que hay que
   * recargarla desde el REST.
   */
  onPartial?: (transactionId: string, actor?: RealtimeActor) => void
  onStatusChange?: (status: WebSocketStatus) => void
  onReconnect?: () => void
}

/**
 * Normaliza los nombres de evento que el backend pueda emitir
 * (e.g. 'TRANSACTION_CREATED', 'transaction.created', 'transaction_created', 'create').
 */
function normalizeEventType(rawEvent: string): RealtimeTransactionEventType | null {
  const norm = rawEvent.toLowerCase().replace(/[-.]/g, '_').trim()
  // Debe evaluarse antes que el alias genérico `update`: este evento actualiza
  // al cliente, no una fila de transacción.
  if (norm === 'client_data_status_updated') return 'CLIENT_DATA_STATUS_UPDATED'
  if (norm === 'transaction_created' || norm === 'create') return 'TRANSACTION_CREATED'
  if (norm === 'transaction_updated' || norm === 'update') return 'TRANSACTION_UPDATED'
  if (norm === 'transaction_deleted' || norm === 'delete') return 'TRANSACTION_DELETED'
  if (norm.includes('bulk') || norm.includes('import')) return 'TRANSACTIONS_BULK_IMPORTED'
  return null
}

export class TransactionsRealtimeClient {
  private service: WebSocketService | null = null
  private unsubscribeList: Array<() => void> = []

  constructor(
    private readonly tokenGetter: () => string | null,
    private readonly wsPath = 'ws/transactions/'
  ) {}

  public connect(callbacks: TransactionsRealtimeCallbacks): void {
    this.disconnect()

    const urlGetter = () => {
      const token = this.tokenGetter()
      return Domain.buildWsUrl(this.wsPath, token)
    }

    this.service = new WebSocketService(urlGetter, {
      // El servidor cierra el socket cuando vence el access token. Renovarlo acá
      // es lo que mantiene vivo el tiempo real en una pestaña sin actividad: sin
      // esto, el token expira, nada dispara el refresh del interceptor HTTP y la
      // reconexión queda rechazada para siempre.
      onAuthFailure: async () => {
        await refreshAccessToken()
      }
    })

    // Listener global para capturar eventos formateados
    const unsubGlobal = this.service.onGlobalMessage((msg) => {
      const rawEvent = (msg.event || msg.type || '') as string
      const eventType = normalizeEventType(rawEvent)
      if (!eventType) return

      const payload = (msg.data || msg.payload || msg) as Record<string, unknown>
      const actor = (msg.actor as RealtimeActor) || undefined

      // Un evento recortado no tiene datos suficientes para mapear la fila:
      // se resuelve recargando, salvo el borrado, que sólo necesita el id.
      if (msg.partial === true && eventType !== 'TRANSACTION_DELETED') {
        const id = String(payload.id ?? '').trim()
        callbacks.onPartial?.(id, actor)
        return
      }

      switch (eventType) {
        case 'TRANSACTION_CREATED': {
          const rawRecord = (payload.transaction || payload.item || payload) as Record<
            string,
            unknown
          >
          if (rawRecord && typeof rawRecord === 'object') {
            const transaction = transactionFromApiRecord(rawRecord)
            callbacks.onCreated?.(transaction, actor)
          }
          break
        }
        case 'TRANSACTION_UPDATED': {
          const rawRecord = (payload.transaction || payload.item || payload) as Record<
            string,
            unknown
          >
          if (rawRecord && typeof rawRecord === 'object') {
            const transaction = transactionFromApiRecord(rawRecord)
            callbacks.onUpdated?.(transaction, actor)
          }
          break
        }
        case 'TRANSACTION_DELETED': {
          const id = String(
            payload.transaction_id ||
              payload.id ||
              (payload.transaction as Record<string, unknown>)?.id ||
              ''
          ).trim()
          if (id) {
            callbacks.onDeleted?.(id, actor)
          }
          break
        }
        case 'TRANSACTIONS_BULK_IMPORTED': {
          const count = typeof payload.count === 'number' ? payload.count : undefined
          callbacks.onBulkImported?.(count)
          break
        }
        case 'CLIENT_DATA_STATUS_UPDATED': {
          const userId = String(payload.user_id ?? '').trim()
          if (userId) callbacks.onClientDataStatusUpdated?.(userId)
          break
        }
      }
    })

    this.unsubscribeList.push(unsubGlobal)

    if (callbacks.onStatusChange) {
      const unsubStatus = this.service.onStatusChange(callbacks.onStatusChange)
      this.unsubscribeList.push(unsubStatus)
    }

    if (callbacks.onReconnect) {
      const unsubReconnect = this.service.onReconnect(callbacks.onReconnect)
      this.unsubscribeList.push(unsubReconnect)
    }

    this.service.connect()
  }

  public disconnect(): void {
    for (const unsub of this.unsubscribeList) {
      try {
        unsub()
      } catch {
        // Ignorar
      }
    }
    this.unsubscribeList = []

    if (this.service) {
      this.service.disconnect()
      this.service = null
    }
  }

  public get isConnected(): boolean {
    return this.service?.isConnected ?? false
  }

  public get currentStatus(): WebSocketStatus {
    return this.service?.currentStatus ?? 'disconnected'
  }
}
