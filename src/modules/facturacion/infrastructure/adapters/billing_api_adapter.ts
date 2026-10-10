import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  BillingStatus,
  Invoice,
  InvoiceEvent,
  InvoiceList,
  InvoiceListFilters,
  InvoicePreview,
  IssueInvoiceInput
} from '../../domain/models'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function optStr(value: unknown): string | null {
  const text = str(value).trim()
  return text ? text : null
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function optNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** SUNAT devuelve `faults`/`notes` como textos u objetos sueltos; la UI solo necesita leerlos. */
export function messagesFromApi(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value]
  return list
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      const o = record(item)
      const text = o.message ?? o.description ?? o.detail ?? o.msg
      if (typeof text === 'string' && text.trim()) {
        return o.code != null ? `${String(o.code)}: ${text.trim()}` : text.trim()
      }
      return Object.keys(o).length ? JSON.stringify(o) : ''
    })
    .filter(Boolean)
}

function endpoint(path: string): string {
  return Domain.apiPath(`billing/${path}`)
}

function eventFromApi(raw: unknown): InvoiceEvent {
  const o = record(raw)
  return {
    id: str(o.id),
    event: str(o.event),
    payload: o.payload ?? null,
    createdAt: optStr(o.created_at)
  }
}

export function invoiceFromApi(raw: unknown): Invoice {
  const o = record(raw)
  return {
    id: str(o.id),
    transactionId: str(o.transaction_id),
    documentType: str(o.document_type),
    documentTypeLabel: str(o.document_type_label),
    series: str(o.series),
    number: Math.round(num(o.number)),
    fullNumber: str(o.full_number),
    fileName: str(o.file_name),
    environment: str(o.environment),
    currency: str(o.currency).toUpperCase(),
    taxableAmount: num(o.taxable_amount),
    igvAmount: num(o.igv_amount),
    totalAmount: num(o.total_amount),
    igvRate: num(o.igv_rate),
    customerDocType: str(o.customer_doc_type),
    customerDocNumber: str(o.customer_doc_number),
    customerName: str(o.customer_name),
    customerAddress: optStr(o.customer_address),
    customerEmail: optStr(o.customer_email),
    status: str(o.status),
    issueDate: optStr(o.issue_date),
    sunatStatus: optStr(o.sunat_status),
    xmlUrl: optStr(o.xml_url),
    cdrUrl: optStr(o.cdr_url),
    hasPdf: o.has_pdf === true,
    faults: messagesFromApi(o.faults),
    notes: messagesFromApi(o.notes),
    lastError: optStr(o.last_error),
    attempts: Math.round(num(o.attempts)),
    sentAt: optStr(o.sent_at),
    acceptedAt: optStr(o.accepted_at),
    voidedAt: optStr(o.voided_at),
    voidReason: optStr(o.void_reason),
    events: records(o.events).map(eventFromApi)
  }
}

export function previewFromApi(raw: unknown): InvoicePreview {
  const o = record(raw)
  return {
    transactionId: str(o.transaction_id),
    canIssue: o.can_issue === true,
    reason: optStr(o.reason),
    enabled: o.enabled === true,
    environment: str(o.environment),
    documentType: optStr(o.document_type),
    documentTypeLabel: optStr(o.document_type_label),
    series: optStr(o.series),
    currency: optStr(o.currency),
    taxableAmount: optNum(o.taxable_amount),
    igvAmount: optNum(o.igv_amount),
    totalAmount: optNum(o.total_amount),
    igvRate: optNum(o.igv_rate),
    customerDocType: optStr(o.customer_doc_type),
    customerDocNumber: optStr(o.customer_doc_number),
    customerName: optStr(o.customer_name),
    customerAddress: optStr(o.customer_address),
    customerEmail: optStr(o.customer_email),
    itemDescription: optStr(o.item_description)
  }
}

export function statusFromApi(raw: unknown): BillingStatus {
  const o = record(raw)
  return {
    enabled: o.enabled === true,
    autoIssue: o.auto_issue === true,
    environment: str(o.environment),
    isProduction: o.is_production === true,
    issuerRuc: str(o.issuer_ruc),
    issuerName: str(o.issuer_name),
    seriesBoleta: str(o.series_boleta),
    seriesFactura: str(o.series_factura),
    commissionIncludesIgv: o.commission_includes_igv === true,
    igvRate: num(o.igv_rate),
    startDate: optStr(o.start_date),
    series: records(o.series).map((s) => ({
      documentType: str(s.document_type),
      series: str(s.series),
      environment: str(s.environment),
      lastNumber: Math.round(num(s.last_number))
    }))
  }
}

/** Solo manda los campos con contenido: el API completa el resto con los datos del cliente. */
export function issueInputToApi(input: IssueInvoiceInput | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  const pairs: Array<[string, string | null | undefined]> = [
    ['document_type', input?.documentType],
    ['customer_name', input?.customerName],
    ['customer_address', input?.customerAddress],
    ['customer_email', input?.customerEmail],
    ['customer_doc_type', input?.customerDocType],
    ['customer_doc_number', input?.customerDocNumber]
  ]
  for (const [key, value] of pairs) {
    const text = value?.trim()
    if (text) out[key] = text
  }
  return out
}

export class BillingApiAdapter {
  async getStatus(): Promise<BillingStatus> {
    const { data } = await apiClient.get(endpoint('status'))
    return statusFromApi(data)
  }

  async listInvoices(filters: InvoiceListFilters = {}): Promise<InvoiceList> {
    const params: Record<string, string | number> = {
      skip: filters.skip ?? 0,
      limit: filters.limit ?? 50
    }
    if (filters.status) params.status = filters.status
    if (filters.documentType) params.document_type = filters.documentType
    if (filters.dateFrom) params.date_from = filters.dateFrom
    if (filters.dateTo) params.date_to = filters.dateTo
    const { data } = await apiClient.get(endpoint('invoices'), { params })
    const o = record(data)
    return {
      items: records(o.items).map(invoiceFromApi),
      total: Math.round(num(o.total)),
      skip: Math.round(num(o.skip)),
      limit: Math.round(num(o.limit))
    }
  }

  /**
   * Último comprobante de cada operación. FastAPI espera `transaction_ids` repetido
   * (`?transaction_ids=a&transaction_ids=b`), no la forma `transaction_ids[]` de axios.
   */
  async latestForTransactions(transactionIds: string[]): Promise<Invoice[]> {
    const ids = [...new Set(transactionIds.filter(Boolean))].slice(0, 100)
    if (!ids.length) return []
    const params = new URLSearchParams()
    for (const id of ids) params.append('transaction_ids', id)
    const { data } = await apiClient.get(endpoint('invoices/by-transactions'), { params })
    return records(data).map(invoiceFromApi)
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const { data } = await apiClient.get(endpoint(`invoices/${invoiceId}`))
    return invoiceFromApi(data)
  }

  async previewForTransaction(
    transactionId: string,
    input?: IssueInvoiceInput
  ): Promise<InvoicePreview> {
    const { data } = await apiClient.get(endpoint(`transactions/${transactionId}/preview`), {
      params: issueInputToApi(input)
    })
    return previewFromApi(data)
  }

  async issueForTransaction(transactionId: string, input?: IssueInvoiceInput): Promise<Invoice> {
    const { data } = await apiClient.post(
      endpoint(`transactions/${transactionId}/issue`),
      issueInputToApi(input)
    )
    return invoiceFromApi(data)
  }

  async refreshInvoice(invoiceId: string): Promise<Invoice> {
    const { data } = await apiClient.post(endpoint(`invoices/${invoiceId}/refresh`))
    return invoiceFromApi(data)
  }

  async retryInvoice(invoiceId: string): Promise<Invoice> {
    const { data } = await apiClient.post(endpoint(`invoices/${invoiceId}/retry`))
    return invoiceFromApi(data)
  }

  async voidInvoice(invoiceId: string, reason: string): Promise<Invoice> {
    const { data } = await apiClient.post(endpoint(`invoices/${invoiceId}/void`), {
      reason: reason.trim()
    })
    return invoiceFromApi(data)
  }

  /** PDF del comprobante (de R2 o, si aún no está, de APISUNAT). */
  async downloadPdf(invoiceId: string): Promise<Blob> {
    const { data } = await apiClient.get(endpoint(`invoices/${invoiceId}/pdf`), {
      responseType: 'blob'
    })
    return data instanceof Blob ? data : new Blob([data as BlobPart], { type: 'application/pdf' })
  }
}
