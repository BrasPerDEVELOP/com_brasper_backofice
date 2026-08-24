import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('@/interface/api/client', () => ({
  apiClient: { get: getMock }
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: {
    apiPath: (path: string) => path.replace(/^\/+|\/+$/g, ''),
    mediaUrl: (path: string) => path
  }
}))

import { TransactionsApiAdapter } from './transactions_api_adapter'

const PAGE = {
  items: [
    {
      id: 'tx-1',
      bank_account_destination_id: 'acc-1',
      user_id: 'user-1',
      tax_rate_id: 'rate-1',
      commission_id: 'commission-1',
      status: 'verification',
      origin_amount: 500,
      destination_amount: 400,
      code: 'PxB-0000000001',
      accounting_percentage: 45
    }
  ],
  total: 1
}

describe('TransactionsApiAdapter listado contable', () => {
  let adapter: TransactionsApiAdapter

  beforeEach(() => {
    adapter = new TransactionsApiAdapter()
    getMock.mockReset()
    getMock.mockResolvedValue({ data: PAGE })
  })

  it('apunta a transactions/accounting, no al listado normal', async () => {
    await adapter.getAccountingTransactions()

    expect(getMock.mock.calls[0][0]).toBe('transactions/accounting')
  })

  it('conserva filtros y paginación en el listado contable', async () => {
    await adapter.getAccountingTransactions({
      status: 'completed',
      search: 'PxB-1',
      skip: 20,
      limit: 10
    })

    const url = getMock.mock.calls[0][0] as string
    expect(url.startsWith('transactions/accounting?')).toBe(true)
    const query = new URLSearchParams(url.split('?')[1])
    expect(query.get('status')).toBe('completed')
    expect(query.get('search')).toBe('PxB-1')
    expect(query.get('skip')).toBe('20')
    expect(query.get('limit')).toBe('10')
  })

  it('mapea accounting_percentage (descuento variable) al modelo', async () => {
    const { items, total } = await adapter.getAccountingTransactions()

    expect(items[0].accounting_percentage).toBe(45)
    expect(total).toBe(1)
  })

  it('deja accounting_percentage vacío cuando ningún tramo cubre el monto', async () => {
    getMock.mockResolvedValue({
      data: { items: [{ ...PAGE.items[0], accounting_percentage: null }], total: 1 }
    })

    const { items } = await adapter.getAccountingTransactions()

    // El API manda null y el mapper no lo convierte en 0: la columna muestra "—".
    expect(items[0].accounting_percentage ?? null).toBeNull()
  })

  it('el listado normal sigue yendo a transactions', async () => {
    await adapter.getTransactions()

    expect(getMock.mock.calls[0][0]).toBe('transactions')
  })
})
