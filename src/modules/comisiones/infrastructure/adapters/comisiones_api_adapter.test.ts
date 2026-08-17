import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteMock, getMock, postMock, putMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn()
}))

vi.mock('@/interface/api/client', () => ({
  apiClient: {
    delete: deleteMock,
    get: getMock,
    post: postMock,
    put: putMock
  }
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: {
    apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '')
  }
}))

import { ComisionesApiAdapter } from './comisiones_api_adapter'

const payload = {
  coin_a: 'USD',
  coin_b: 'BRL',
  percentage: '1',
  reverse: '0',
  min_amount: '0',
  max_amount: '100'
}

describe('ComisionesApiAdapter', () => {
  beforeEach(() => {
    deleteMock.mockReset().mockResolvedValue({ data: null })
    getMock.mockReset().mockResolvedValue({ data: [] })
    postMock.mockReset().mockResolvedValue({ data: {} })
    putMock.mockReset().mockResolvedValue({ data: {} })
  })

  it('apunta a coin/commission por defecto (comisiones de venta)', async () => {
    const adapter = new ComisionesApiAdapter()

    await adapter.getCommissions()
    await adapter.createCommission(payload)
    await adapter.updateCommission('c-1', { ...payload, id: 'c-1', percentage: 1, min_amount: 0, max_amount: 100 })
    await adapter.deleteCommission('c-1')
    await adapter.getCommissionHistory('c-1')

    expect(getMock.mock.calls[0][0]).toBe('coin/commission')
    expect(postMock.mock.calls[0][0]).toBe('coin/commission')
    expect(putMock.mock.calls[0][0]).toBe('coin/commission')
    expect(deleteMock.mock.calls[0][0]).toBe('coin/commission/c-1')
    expect(getMock.mock.calls[1][0]).toBe('coin/commission/c-1/history')
  })

  it('apunta a coin/commission-accounting para las comisiones de contabilidad', async () => {
    const adapter = new ComisionesApiAdapter('commission-accounting')

    await adapter.getCommissions()
    await adapter.createCommission(payload)
    await adapter.updateCommission('c-1', { ...payload, id: 'c-1', percentage: 1, min_amount: 0, max_amount: 100 })
    await adapter.deleteCommission('c-1')

    expect(getMock.mock.calls[0][0]).toBe('coin/commission-accounting')
    expect(postMock.mock.calls[0][0]).toBe('coin/commission-accounting')
    expect(putMock.mock.calls[0][0]).toBe('coin/commission-accounting')
    expect(deleteMock.mock.calls[0][0]).toBe('coin/commission-accounting/c-1')
  })

  it('manda el id en el body del PUT, no en la URL', async () => {
    const adapter = new ComisionesApiAdapter('commission-accounting')

    await adapter.updateCommission('c-9', {
      ...payload,
      id: 'ignorado',
      percentage: 2,
      min_amount: 0,
      max_amount: 500
    })

    expect(putMock.mock.calls[0][1]).toMatchObject({ id: 'c-9', percentage: 2 })
  })
})
