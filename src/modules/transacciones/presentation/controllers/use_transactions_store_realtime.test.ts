import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransactionsStore } from './use_transactions_store_controller'
import type { Transaction } from '../../domain/models'

describe('useTransactionsStore - Realtime Mutations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('applyRealtimeCreated inserta al inicio y suma total cuando prependToVisible es true', () => {
    const store = useTransactionsStore()
    store.transactions = [{ id: 'tx_old', origin_amount: 50 }]
    store.total = 1

    const newTx: Transaction = { id: 'tx_new', origin_amount: 100 }
    store.applyRealtimeCreated(newTx, { prependToVisible: true })

    expect(store.transactions.length).toBe(2)
    expect(store.transactions[0].id).toBe('tx_new')
    expect(store.total).toBe(2)
    expect(store.lastRealtimeEvent?.type).toBe('created')
  })

  it('applyRealtimeCreated solo incrementa total y unseen count cuando prependToVisible es false', () => {
    const store = useTransactionsStore()
    store.transactions = [{ id: 'tx_page2_item', origin_amount: 50 }]
    store.total = 15

    const newTx: Transaction = { id: 'tx_new', origin_amount: 100 }
    store.applyRealtimeCreated(newTx, { prependToVisible: false })

    expect(store.transactions.length).toBe(1)
    expect(store.total).toBe(16)
    expect(store.unseenRealtimeCount).toBe(1)
  })

  it('applyRealtimeUpdated actualiza la transacción en memoria si existe', () => {
    const store = useTransactionsStore()
    store.transactions = [
      { id: 'tx_1', status: 'pending' },
      { id: 'tx_2', status: 'pending' }
    ]

    store.applyRealtimeUpdated({ id: 'tx_2', status: 'completed' })

    expect(store.transactions[1].status).toBe('completed')
    expect(store.lastRealtimeEvent?.type).toBe('updated')
  })

  it('applyRealtimeDeleted elimina la transacción en memoria y decrementa total', () => {
    const store = useTransactionsStore()
    store.transactions = [
      { id: 'tx_1', origin_amount: 10 },
      { id: 'tx_2', origin_amount: 20 }
    ]
    store.total = 2

    store.applyRealtimeDeleted('tx_1')

    expect(store.transactions.length).toBe(1)
    expect(store.transactions[0].id).toBe('tx_2')
    expect(store.total).toBe(1)
    expect(store.lastRealtimeEvent?.type).toBe('deleted')
  })
})
