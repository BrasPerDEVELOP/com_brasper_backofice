import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Transaction } from '../../domain/models'

const getTransactions = vi.fn()

vi.mock('../../infrastructure/adapters', () => ({
  TransactionsApiAdapter: class {
    getTransactions = getTransactions
  }
}))

import { useTransactionsStore } from './use_transactions_store_controller'

const tx = (id: string, sendDate: string): Transaction =>
  ({ id, send_date: sendDate, created_at: sendDate }) as Transaction

describe('correlativo diario en el store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getTransactions.mockReset()
  })

  it('numera el día completo, no solo la página visible', async () => {
    // El API pagina de 10 en 10; el día tiene 12 envíos.
    const wholeDay = Array.from({ length: 12 }, (_, i) =>
      tx(`t${i + 1}`, `2026-08-05T${String(7 + i).padStart(2, '0')}:00:00`)
    )
    getTransactions.mockResolvedValue({ items: wholeDay, total: 12 })

    const store = useTransactionsStore()
    await store.loadDailySequences(['2026-08-05'])

    expect(store.dailySequenceById['t1']).toBe(1)
    expect(store.dailySequenceById['t12']).toBe(12)
  })

  it('pide el día completo por send_date', async () => {
    getTransactions.mockResolvedValue({ items: [], total: 0 })
    const store = useTransactionsStore()
    await store.loadDailySequences(['2026-08-05'])

    const params = getTransactions.mock.calls[0][0]
    expect(Date.parse(params.send_date_from)).toBeLessThan(
      Date.parse(params.send_date_to)
    )
  })

  it('nunca pide más de 100 por página: el endpoint declara le=100 y devolvería 422', () => {
    getTransactions.mockResolvedValue({ items: [], total: 0 })
    const store = useTransactionsStore()
    return store.loadDailySequences(['2026-08-05']).then(() => {
      for (const [params] of getTransactions.mock.calls) {
        expect(params.limit).toBeLessThanOrEqual(100)
      }
    })
  })

  it('pagina los días con más de 100 envíos y los numera de corrido', async () => {
    const page = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) =>
        tx(`t${from + i}`, `2026-08-05T00:00:00.${String(from + i).padStart(4, '0')}Z`)
      )
    getTransactions
      .mockResolvedValueOnce({ items: page(1, 100), total: 130 })
      .mockResolvedValueOnce({ items: page(101, 30), total: 130 })

    const store = useTransactionsStore()
    await store.loadDailySequences(['2026-08-05'])

    expect(getTransactions).toHaveBeenCalledTimes(2)
    expect(getTransactions.mock.calls[1][0].skip).toBe(100)
    expect(store.dailySequenceById['t1']).toBe(1)
    expect(store.dailySequenceById['t101']).toBe(101)
    expect(store.dailySequenceById['t130']).toBe(130)
  })

  it('no sigue paginando cuando el día cabe en una sola página', async () => {
    getTransactions.mockResolvedValue({ items: [tx('a', '2026-08-05T07:00:00Z')], total: 1 })
    const store = useTransactionsStore()
    await store.loadDailySequences(['2026-08-05'])
    expect(getTransactions).toHaveBeenCalledTimes(1)
  })

  it('no vuelve a pedir un día ya resuelto', async () => {
    getTransactions.mockResolvedValue({ items: [tx('a', '2026-08-05T07:00:00')], total: 1 })
    const store = useTransactionsStore()
    await store.loadDailySequences(['2026-08-05'])
    await store.loadDailySequences(['2026-08-05'])
    expect(getTransactions).toHaveBeenCalledTimes(1)
  })

  it('resetDailySequences fuerza el repedido y avisa a la vista', async () => {
    getTransactions.mockResolvedValue({ items: [tx('a', '2026-08-05T07:00:00')], total: 1 })
    const store = useTransactionsStore()
    await store.loadDailySequences(['2026-08-05'])
    const generationBefore = store.sequenceGeneration

    store.resetDailySequences()
    expect(store.dailySequenceById).toEqual({})
    // La generación es lo que dispara el watcher aunque los días no cambien.
    expect(store.sequenceGeneration).toBe(generationBefore + 1)

    await store.loadDailySequences(['2026-08-05'])
    expect(getTransactions).toHaveBeenCalledTimes(2)
  })

  it('un día que falla no rompe la vista ni queda marcado como resuelto', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getTransactions.mockRejectedValue(new Error('500'))
    const store = useTransactionsStore()
    await store.loadDailySequences(['2026-08-05'])

    expect(store.dailySequenceById).toEqual({})
    expect(store.loadedSequenceDays).toEqual([])
    expect(store.error).toBeNull()
    // El fallo no puede quedar mudo: un 422 se vería igual que un día vacío.
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
