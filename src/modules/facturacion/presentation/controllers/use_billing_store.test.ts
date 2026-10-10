import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Invoice } from '../../domain/models'

const adapter = vi.hoisted(() => ({
  latestForTransactions: vi.fn(),
  retryInvoice: vi.fn(),
  issueForTransaction: vi.fn()
}))

vi.mock('../../infrastructure/adapters/billing_api_adapter', () => ({
  BillingApiAdapter: vi.fn(() => adapter)
}))

import { billingErrorMessage, useBillingStore } from './use_billing_store'

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'inv',
    transactionId: 'tx',
    issuerRuc: '20608550454',
    issuerName: 'brasper transferencias',
    documentType: '03',
    documentTypeLabel: 'Boleta de venta',
    series: 'B001',
    number: 1,
    fullNumber: 'B001-00000001',
    fileName: 'f',
    environment: 'development',
    currency: 'PEN',
    taxableAmount: 33.9,
    igvAmount: 6.1,
    totalAmount: 40,
    igvRate: 0.18,
    customerDocType: '1',
    customerDocNumber: '1',
    customerName: 'X',
    customerAddress: null,
    customerEmail: null,
    status: 'sent',
    issueDate: null,
    sunatStatus: null,
    xmlUrl: null,
    cdrUrl: null,
    hasPdf: false,
    faults: [],
    notes: [],
    lastError: null,
    attempts: 1,
    sentAt: null,
    acceptedAt: null,
    voidedAt: null,
    voidReason: null,
    events: [],
    ...overrides
  }
}

describe('useBillingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(adapter).forEach((fn) => fn.mockReset())
  })

  it('carga los comprobantes de la página y olvida los de operaciones que ya no tienen', async () => {
    const store = useBillingStore()
    store.byTransaction = { 'tx-2': invoice({ id: 'viejo', transactionId: 'tx-2' }) }
    adapter.latestForTransactions.mockResolvedValue([invoice({ id: 'a', transactionId: 'tx-1' })])

    await store.loadForTransactions(['tx-1', 'tx-2'])

    expect(store.invoiceFor('tx-1')?.id).toBe('a')
    expect(store.invoiceFor('tx-2')).toBeNull()
    expect(store.pendingTransactionIds).toEqual(['tx-1'])
  })

  it('un reintento de rechazado reemplaza el comprobante de la operación por el nuevo', async () => {
    const store = useBillingStore()
    store.byTransaction = { tx: invoice({ id: 'rechazado', status: 'rejected' }) }
    adapter.retryInvoice.mockResolvedValue(invoice({ id: 'nuevo', number: 2, status: 'sent' }))

    await store.retry('rechazado')
    expect(store.invoiceFor('tx')).toMatchObject({ id: 'nuevo', number: 2 })
  })

  it('mensajes de error legibles', () => {
    const err = Object.assign(new Error('x'), {
      isAxiosError: true,
      response: { status: 503, data: {} }
    })
    expect(billingErrorMessage(err, 'fallback')).toContain('apagada')
    expect(billingErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
    expect(billingErrorMessage(null, 'fallback')).toBe('fallback')
  })
})
