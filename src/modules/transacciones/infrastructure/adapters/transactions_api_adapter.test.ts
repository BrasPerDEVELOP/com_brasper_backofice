import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }))

vi.mock('@/interface/api/client', () => ({
  apiClient: {
    put: putMock
  },
  getApiAuthHeaders: () => ({}),
  triggerUnauthorized: vi.fn()
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: {
    apiPath: (path: string) => path,
    apiUrl: (path: string) => `https://api.test/${path}`
  }
}))

import { TransactionsApiAdapter } from './transactions_api_adapter'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

describe('TransactionsApiAdapter social_reason_bank_id', () => {
  const fetchMock = vi.fn()
  let adapter: TransactionsApiAdapter

  beforeEach(() => {
    adapter = new TransactionsApiAdapter()
    fetchMock.mockReset()
    putMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envía el ID exacto en el FormData del POST', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'tx-1' }))

    await adapter.createTransaction({
      bank_account_destination: 'destination-account',
      user_id: 'user-1',
      tax_rate_id: 'rate-1',
      commission_id: 'commission-1',
      origin_amount: 100,
      destination_amount: 63,
      code: 'TX-1',
      social_reason_bank_id: ' santander-id '
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const form = init.body as FormData
    expect(form.get('social_reason_bank_id')).toBe('santander-id')
  })

  it('serializa las cuentas destino en el multipart del POST', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'tx-1' }))
    const destinations = [
      { bank_account_id: 'bcp', amount: 300 },
      { bank_account_id: 'interbank', amount: 330 }
    ]

    await adapter.createTransaction({
      bank_account_destination: 'bcp',
      destinations,
      user_id: 'user-1',
      tax_rate_id: 'rate-1',
      commission_id: 'commission-1',
      origin_amount: 1000,
      destination_amount: 630,
      code: 'TX-1'
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.body as FormData).get('destinations')).toBe(JSON.stringify(destinations))
  })

  it('conserva null explícito en PUT para limpiar la selección', async () => {
    putMock.mockResolvedValue({ data: { id: 'tx-1' } })

    await adapter.updateTransaction('tx-1', { social_reason_bank_id: null })

    expect(putMock).toHaveBeenCalledWith('transactions/', {
      id: 'tx-1',
      social_reason_bank_id: null
    })
  })

  it('normaliza un string vacío a null en PUT', async () => {
    putMock.mockResolvedValue({ data: { id: 'tx-1' } })

    await adapter.updateTransaction('tx-1', { social_reason_bank_id: '   ' })

    expect(putMock).toHaveBeenCalledWith('transactions/', {
      id: 'tx-1',
      social_reason_bank_id: null
    })
  })
})
