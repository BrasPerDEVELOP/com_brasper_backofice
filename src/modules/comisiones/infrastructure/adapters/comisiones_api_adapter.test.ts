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
  percentage: 1,
  reverse: '0',
  min_amount: 0,
  max_amount: 100
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
    await adapter.updateCommission('c-1', { ...payload, id: 'c-1' })
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
    await adapter.updateCommission('c-1', { ...payload, id: 'c-1' })
    await adapter.deleteCommission('c-1')

    expect(getMock.mock.calls[0][0]).toBe('coin/commission-accounting')
    expect(postMock.mock.calls[0][0]).toBe('coin/commission-accounting')
    expect(putMock.mock.calls[0][0]).toBe('coin/commission-accounting')
    expect(deleteMock.mock.calls[0][0]).toBe('coin/commission-accounting/c-1')
  })

  it('manda el id en el body del PUT, no en la URL', async () => {
    const adapter = new ComisionesApiAdapter('commission-accounting')

    await adapter.updateCommission('c-9', { ...payload, id: 'ignorado', percentage: 2, max_amount: 500 })

    expect(putMock.mock.calls[0][1]).toMatchObject({ id: 'c-9', percentage: 2 })
  })

  describe('tramo sin límite superior (max_amount null)', () => {
    it('conserva null al leer, en vez de convertirlo a 0', async () => {
      getMock.mockResolvedValue({
        data: [
          { id: 'c-1', coin_a: 'pen', coin_b: 'brl', percentage: 40, reverse: 0, min_amount: 100, max_amount: 299 },
          { id: 'c-8', coin_a: 'pen', coin_b: 'brl', percentage: 75, reverse: 0, min_amount: 10000, max_amount: null }
        ]
      })
      const adapter = new ComisionesApiAdapter()

      const commissions = await adapter.getCommissions()

      expect(commissions[0]?.max_amount).toBe(299)
      expect(commissions[1]?.max_amount).toBeNull()
      expect(commissions[1]?.coin_a).toBe('PEN')
    })

    it('trata max_amount ausente como null', async () => {
      getMock.mockResolvedValue({
        data: [{ id: 'c-8', coin_a: 'pen', coin_b: 'brl', percentage: 75, reverse: 0, min_amount: 10000 }]
      })
      const adapter = new ComisionesApiAdapter()

      const commissions = await adapter.getCommissions()

      expect(commissions[0]?.max_amount).toBeNull()
    })

    it('envía null en el POST y en el PUT', async () => {
      const adapter = new ComisionesApiAdapter()

      await adapter.createCommission({ ...payload, max_amount: null })
      await adapter.updateCommission('c-8', { ...payload, id: 'c-8', max_amount: null })

      expect(postMock.mock.calls[0][1]).toMatchObject({ max_amount: null })
      expect(putMock.mock.calls[0][1]).toMatchObject({ id: 'c-8', max_amount: null })
    })

    it('si el API responde vacío, refleja el body enviado incluyendo el null', async () => {
      postMock.mockResolvedValue({ data: null })
      const adapter = new ComisionesApiAdapter()

      const created = await adapter.createCommission({ ...payload, max_amount: null })

      expect(created.max_amount).toBeNull()
      expect(created.min_amount).toBe(0)
    })
  })
})
