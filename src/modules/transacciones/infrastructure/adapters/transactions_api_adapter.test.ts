import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteMock, postMock, putMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn()
}))

vi.mock('@/interface/api/client', () => ({
  apiClient: {
    delete: deleteMock,
    post: postMock,
    put: putMock
  }
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: {
    apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '')
  }
}))

import { TransactionsApiAdapter } from './transactions_api_adapter'

describe('TransactionsApiAdapter social_reason_bank_id', () => {
  let adapter: TransactionsApiAdapter

  beforeEach(() => {
    adapter = new TransactionsApiAdapter()
    deleteMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
  })

  it('envía el ID exacto en el FormData del POST', async () => {
    postMock.mockResolvedValue({ data: { id: 'tx-1' } })

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

    const [, form] = postMock.mock.calls[0] as [string, FormData]
    expect(form.get('social_reason_bank_id')).toBe('santander-id')
  })

  it('serializa las cuentas destino en el multipart del POST', async () => {
    postMock.mockResolvedValue({ data: { id: 'tx-1' } })
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

    const [, form] = postMock.mock.calls[0] as [string, FormData]
    expect(form.get('destinations')).toBe(JSON.stringify(destinations))
  })

  it('conserva null explícito en PUT para limpiar la selección', async () => {
    putMock.mockResolvedValue({ data: { id: 'tx-1' } })

    await adapter.updateTransaction('tx-1', { social_reason_bank_id: null })

    expect(putMock).toHaveBeenCalledWith('transactions', {
      id: 'tx-1',
      social_reason_bank_id: null
    })
  })

  it('normaliza un string vacío a null en PUT', async () => {
    putMock.mockResolvedValue({ data: { id: 'tx-1' } })

    await adapter.updateTransaction('tx-1', { social_reason_bank_id: '   ' })

    expect(putMock).toHaveBeenCalledWith('transactions', {
      id: 'tx-1',
      social_reason_bank_id: null
    })
  })

  it('envía billing_date en PUT para actualizar la fecha de facturación', async () => {
    putMock.mockResolvedValue({ data: { id: 'tx-1', billing_date: '2026-09-03T10:15:00Z' } })

    await adapter.updateTransaction('tx-1', {
      billing_date: '2026-09-03T10:15:00.000Z'
    })

    expect(putMock).toHaveBeenCalledWith('transactions', {
      id: 'tx-1',
      billing_date: '2026-09-03T10:15:00.000Z'
    })
  })

  it('usa la ruta contable para registrar billing_date desde Contabilidad', async () => {
    putMock.mockResolvedValue({ data: { id: 'tx-1', billing_date: '2026-09-03T10:15:00Z' } })

    await adapter.updateAccountingBillingDate('tx-1', '2026-09-03T10:15:00.000Z')

    expect(putMock).toHaveBeenCalledWith('transactions/accounting/billing-date', {
      id: 'tx-1',
      billing_date: '2026-09-03T10:15:00.000Z'
    })
  })

  it('envía el nuevo cliente, sus cuentas y una lista vacía para quitar etiquetas', async () => {
    putMock.mockResolvedValue({ data: { id: 'tx-1' } })
    const destinations = [
      { bank_account_id: 'account-new', amount: 630 }
    ]

    await adapter.updateTransaction('tx-1', {
      user_id: 'client-new',
      bank_account_destination: 'account-new',
      destinations,
      tag_ids: [],
      agent_id: undefined
    })

    expect(putMock).toHaveBeenCalledWith('transactions', {
      id: 'tx-1',
      user_id: 'client-new',
      bank_account_destination: 'account-new',
      destinations,
      tag_ids: []
    })
  })

  it('elimina sin barra final para evitar la redirección 307 hacia HTTP', async () => {
    deleteMock.mockResolvedValue({ data: null })

    await adapter.deleteTransaction('tx-1')

    expect(deleteMock).toHaveBeenCalledWith('transactions/tx-1')
  })
})
