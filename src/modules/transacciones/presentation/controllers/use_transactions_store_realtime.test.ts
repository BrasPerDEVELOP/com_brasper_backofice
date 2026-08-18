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

  describe('carrera entre el evento en tiempo real y la respuesta del POST', () => {
    it('no duplica la fila cuando el evento llega antes de que responda el POST', () => {
      const store = useTransactionsStore()
      store.transactions = [{ id: 'tx_old', origin_amount: 50 }]
      store.total = 1

      const creada: Transaction = { id: 'tx_new', origin_amount: 100 }

      // 1) El backend difunde el evento dentro del endpoint: llega primero.
      store.applyRealtimeCreated(creada, { prependToVisible: true })
      // 2) Después vuelve la respuesta del POST con la misma transacción.
      store.upsertTransaction(creada)

      const conEseId = store.transactions.filter((t) => t.id === 'tx_new')
      expect(conEseId.length).toBe(1)
      expect(store.transactions.length).toBe(2)
      expect(store.total).toBe(2)
    })

    it('no duplica tampoco en el orden inverso: POST primero, evento después', () => {
      const store = useTransactionsStore()
      store.transactions = []
      store.total = 0

      const creada: Transaction = { id: 'tx_new', origin_amount: 100 }
      store.upsertTransaction(creada)
      store.applyRealtimeCreated(creada, { prependToVisible: true })

      expect(store.transactions.length).toBe(1)
      expect(store.total).toBe(1)
    })

    it('upsertTransaction reemplaza los datos de la fila existente en vez de agregarla', () => {
      const store = useTransactionsStore()
      store.transactions = [{ id: 'tx_1', origin_amount: 100 }]
      store.total = 1

      const eraNueva = store.upsertTransaction({ id: 'tx_1', origin_amount: 250 })

      expect(eraNueva).toBe(false)
      expect(store.transactions.length).toBe(1)
      expect(store.transactions[0].origin_amount).toBe(250)
      expect(store.total).toBe(1)
    })

    it('no descuenta total dos veces si el evento de borrado ya quitó la fila', () => {
      const store = useTransactionsStore()
      store.transactions = [
        { id: 'tx_1', origin_amount: 100 },
        { id: 'tx_2', origin_amount: 200 }
      ]
      store.total = 2

      // El evento en tiempo real la quita primero.
      store.applyRealtimeDeleted('tx_1')
      expect(store.total).toBe(1)

      // El borrado local ya no la encuentra: no debe volver a descontar.
      const wasPresent = store.transactions.some((t) => t.id === 'tx_1')
      expect(wasPresent).toBe(false)
      if (wasPresent) store.total = Math.max(0, store.total - 1)

      expect(store.total).toBe(1)
    })

    it('una transacción sin id se trata como nueva en vez de pisar otra fila', () => {
      const store = useTransactionsStore()
      store.transactions = [{ origin_amount: 50 } as Transaction]
      store.total = 1

      const eraNueva = store.upsertTransaction({ origin_amount: 100 } as Transaction)

      expect(eraNueva).toBe(true)
      expect(store.transactions.length).toBe(2)
    })
  })
})
