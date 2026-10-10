import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/interface/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))
vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '') }
}))

import { apiClient } from '@/interface/api/client'
import { BillingApiAdapter, issueInputToApi, messagesFromApi } from './billing_api_adapter'

const RAW_INVOICE = {
  id: 'inv-1',
  transaction_id: 'tx-1',
  issuer_ruc: '20611936428',
  issuer_name: 'INGENITECH S.A.C.',
  document_type: '03',
  document_type_label: 'Boleta de venta',
  series: 'B001',
  number: 7,
  full_number: 'B001-00000007',
  file_name: '20608550454-03-B001-00000007',
  environment: 'development',
  currency: 'pen',
  taxable_amount: 33.9,
  igv_amount: '6.10',
  total_amount: 40,
  igv_rate: 0.18,
  customer_doc_type: '1',
  customer_doc_number: '45678912',
  customer_name: 'MARIA PEREZ',
  customer_address: '',
  status: 'rejected',
  issue_date: '2026-10-10T15:00:00Z',
  has_pdf: false,
  faults: [{ code: '2800', message: 'El dato ingresado no cumple el formato' }, 'Otro error'],
  notes: null,
  attempts: 2,
  events: [{ id: 'e1', event: 'reserved', payload: { a: 1 }, created_at: '2026-10-10T15:00:00Z' }]
}

describe('BillingApiAdapter', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
  })

  it('normaliza el comprobante: números, moneda, vacíos y mensajes de SUNAT', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: RAW_INVOICE })
    const invoice = await new BillingApiAdapter().getInvoice('inv-1')

    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('billing/invoices/inv-1')
    expect(invoice).toMatchObject({
      issuerRuc: '20611936428',
      issuerName: 'INGENITECH S.A.C.',
      fullNumber: 'B001-00000007',
      currency: 'PEN',
      igvAmount: 6.1,
      customerAddress: null,
      hasPdf: false,
      attempts: 2
    })
    expect(invoice.faults).toEqual(['2800: El dato ingresado no cumple el formato', 'Otro error'])
    expect(invoice.notes).toEqual([])
    expect(invoice.events[0]).toMatchObject({ event: 'reserved', createdAt: '2026-10-10T15:00:00Z' })
  })

  it('pide los comprobantes de una página con transaction_ids repetido y sin duplicados', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [RAW_INVOICE] })
    const items = await new BillingApiAdapter().latestForTransactions(['tx-1', 'tx-2', 'tx-1', ''])

    const [url, config] = vi.mocked(apiClient.get).mock.calls[0]
    expect(url).toBe('billing/invoices/by-transactions')
    expect((config?.params as URLSearchParams).toString()).toBe(
      'transaction_ids=tx-1&transaction_ids=tx-2'
    )
    expect(items).toHaveLength(1)
  })

  it('no llama al API si la página no tiene operaciones', async () => {
    expect(await new BillingApiAdapter().latestForTransactions([])).toEqual([])
    expect(vi.mocked(apiClient.get)).not.toHaveBeenCalled()
  })

  it('emite mandando solo los datos del adquirente con contenido', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ...RAW_INVOICE, status: 'sent' } })
    const invoice = await new BillingApiAdapter().issueForTransaction('tx-1', {
      customerName: '  Acme SAC ',
      customerAddress: '',
      customerEmail: null
    })
    expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith('billing/transactions/tx-1/issue', {
      customer_name: 'Acme SAC'
    })
    expect(invoice.status).toBe('sent')
  })

  it('vista previa: explica por qué no se puede emitir', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        transaction_id: 'tx-1',
        can_issue: false,
        reason: 'Falta la razón social del cliente con RUC',
        enabled: true,
        environment: 'development',
        total_amount: null
      }
    })
    const preview = await new BillingApiAdapter().previewForTransaction('tx-1', {
      customerEmail: 'a@b.pe'
    })
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('billing/transactions/tx-1/preview', {
      params: { customer_email: 'a@b.pe' }
    })
    expect(preview).toMatchObject({ canIssue: false, totalAmount: null, environment: 'development' })
    expect(preview.reason).toContain('razón social')
  })

  it('anula con el motivo recortado y descarga el PDF como blob', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ...RAW_INVOICE, status: 'voided' } })
    await new BillingApiAdapter().voidInvoice('inv-1', '  Error en el monto  ')
    expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith('billing/invoices/inv-1/void', {
      reason: 'Error en el monto'
    })

    const blob = new Blob(['%PDF'], { type: 'application/pdf' })
    vi.mocked(apiClient.get).mockResolvedValue({ data: blob })
    expect(await new BillingApiAdapter().downloadPdf('inv-1')).toBe(blob)
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('billing/invoices/inv-1/pdf', {
      responseType: 'blob'
    })
  })

  it('lee las empresas emisoras del estado y filtra el listado por empresa', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        enabled: true,
        environment: 'development',
        default_issuer_ruc: '20608550454',
        issuers: [
          { ruc: '20608550454', name: 'BRASPER 21 S.A.C.', is_default: true, configured: true },
          { ruc: '20611936428', name: 'INGENITECH S.A.C.', configured: false }
        ],
        series: [{ issuer_ruc: '20611936428', document_type: '03', series: 'B001', last_number: 4 }]
      }
    })
    const status = await new BillingApiAdapter().getStatus()
    expect(status.issuers.map((i) => [i.ruc, i.isDefault, i.configured])).toEqual([
      ['20608550454', true, true],
      ['20611936428', false, false]
    ])
    expect(status.series[0]).toMatchObject({ issuerRuc: '20611936428', lastNumber: 4 })

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [], total: 0 } })
    await new BillingApiAdapter().listInvoices({ issuerRuc: '20611936428' })
    expect(vi.mocked(apiClient.get)).toHaveBeenLastCalledWith('billing/invoices', {
      params: { skip: 0, limit: 50, issuer_ruc: '20611936428' }
    })
  })

  it('helpers de serialización', () => {
    expect(issueInputToApi(undefined)).toEqual({})
    expect(
      issueInputToApi({ documentType: '01', customerDocType: '6', customerDocNumber: '20123456789' })
    ).toEqual({ document_type: '01', customer_doc_type: '6', customer_doc_number: '20123456789' })
    expect(issueInputToApi({ issuerRuc: '20611936428' })).toEqual({ issuer_ruc: '20611936428' })
    expect(messagesFromApi('uno')).toEqual(['uno'])
    expect(messagesFromApi([{ description: 'dos' }, {}])).toEqual(['dos'])
  })
})
