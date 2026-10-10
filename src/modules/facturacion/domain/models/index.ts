/**
 * Facturación electrónica (boletas y facturas vía APISUNAT).
 * Espejo de los DTO de `GET/POST /billing/*` del API, en camelCase.
 */

/** Ciclo de vida del comprobante dentro de Brasper (`billing.invoices.status`). */
export const INVOICE_STATUSES = [
  'reserved',
  'sent',
  'accepted',
  'rejected',
  'exception',
  'error',
  'voided'
] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export type InvoiceTone = 'neutral' | 'pending' | 'success' | 'danger' | 'muted'

export interface InvoiceStatusMeta {
  label: string
  tone: InvoiceTone
  /** Qué significa para quien opera, en una frase. */
  hint: string
}

const STATUS_META: Record<InvoiceStatus, InvoiceStatusMeta> = {
  reserved: {
    label: 'Enviando',
    tone: 'pending',
    hint: 'Número reservado; se está enviando a APISUNAT.'
  },
  sent: {
    label: 'En SUNAT',
    tone: 'pending',
    hint: 'APISUNAT lo recibió; esperando la respuesta de SUNAT.'
  },
  accepted: {
    label: 'Aceptado',
    tone: 'success',
    hint: 'SUNAT lo aceptó. Tiene validez tributaria (en producción).'
  },
  rejected: {
    label: 'Rechazado',
    tone: 'danger',
    hint: 'SUNAT lo rechazó y el número quedó usado. Reintentar emite uno nuevo.'
  },
  exception: {
    label: 'Excepción',
    tone: 'danger',
    hint: 'SUNAT no lo validó; el número sigue libre. Reintentar lo reenvía.'
  },
  error: {
    label: 'Error de envío',
    tone: 'danger',
    hint: 'No llegó a SUNAT. Reintentar verifica en APISUNAT y lo reenvía.'
  },
  voided: {
    label: 'Anulado',
    tone: 'muted',
    hint: 'Dado de baja.'
  }
}

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value)
}

export function invoiceStatusMeta(status: string): InvoiceStatusMeta {
  return isInvoiceStatus(status)
    ? STATUS_META[status]
    : { label: status || 'Desconocido', tone: 'neutral', hint: '' }
}

/** Estados que esperan a SUNAT: la UI los vuelve a consultar sola. */
export function isInvoicePending(status: string): boolean {
  return status === 'reserved' || status === 'sent'
}

/** Mismo criterio que `InvoiceStatus.can_retry` del API. */
export function canRetryInvoice(status: string): boolean {
  return status === 'rejected' || status === 'exception' || status === 'error'
}

/** Solo un comprobante aceptado se puede anular (`POST /billing/invoices/{id}/void`). */
export function canVoidInvoice(status: string): boolean {
  return status === 'accepted'
}

/** Sin comprobante vivo (o con uno fallido/anulado) la operación se puede volver a emitir. */
export function canIssueAgain(status: string | null | undefined): boolean {
  return !status || status === 'voided'
}

/** Catálogo 06 de SUNAT: tipo de documento del adquirente. */
export const SUNAT_IDENTITY_LABELS: Record<string, string> = {
  '0': 'Sin documento',
  '1': 'DNI',
  '4': 'Carné de extranjería',
  '6': 'RUC',
  '7': 'Pasaporte'
}

export function sunatIdentityLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return SUNAT_IDENTITY_LABELS[code] ?? code
}

export interface InvoiceEvent {
  id: string
  event: string
  payload: unknown
  createdAt: string | null
}

export interface Invoice {
  id: string
  transactionId: string
  documentType: string
  documentTypeLabel: string
  series: string
  number: number
  fullNumber: string
  fileName: string
  environment: string
  currency: string
  taxableAmount: number
  igvAmount: number
  totalAmount: number
  igvRate: number
  customerDocType: string
  customerDocNumber: string
  customerName: string
  customerAddress: string | null
  customerEmail: string | null
  status: string
  issueDate: string | null
  sunatStatus: string | null
  xmlUrl: string | null
  cdrUrl: string | null
  hasPdf: boolean
  /** Errores de SUNAT (`faults`) y observaciones (`notes`), ya como texto. */
  faults: string[]
  notes: string[]
  lastError: string | null
  attempts: number
  sentAt: string | null
  acceptedAt: string | null
  voidedAt: string | null
  voidReason: string | null
  events: InvoiceEvent[]
}

export interface InvoiceList {
  items: Invoice[]
  total: number
  skip: number
  limit: number
}

/** Lo que saldría al emitir (`GET /billing/transactions/{id}/preview`). */
export interface InvoicePreview {
  transactionId: string
  canIssue: boolean
  reason: string | null
  enabled: boolean
  environment: string
  documentType: string | null
  documentTypeLabel: string | null
  series: string | null
  currency: string | null
  taxableAmount: number | null
  igvAmount: number | null
  totalAmount: number | null
  igvRate: number | null
  customerDocType: string | null
  customerDocNumber: string | null
  customerName: string | null
  customerAddress: string | null
  customerEmail: string | null
  itemDescription: string | null
}

/** Datos del adquirente que el operador puede completar o corregir al emitir. */
export interface IssueInvoiceInput {
  /** `03` boleta o `01` factura. Vacío = automático (RUC → factura). */
  documentType?: '01' | '03' | null
  customerName?: string | null
  customerAddress?: string | null
  customerEmail?: string | null
  customerDocType?: string | null
  customerDocNumber?: string | null
}

export interface BillingSeriesStatus {
  documentType: string
  series: string
  environment: string
  lastNumber: number
}

export interface BillingStatus {
  enabled: boolean
  autoIssue: boolean
  environment: string
  isProduction: boolean
  issuerRuc: string
  issuerName: string
  seriesBoleta: string
  seriesFactura: string
  commissionIncludesIgv: boolean
  igvRate: number
  startDate: string | null
  series: BillingSeriesStatus[]
}

export interface InvoiceListFilters {
  status?: string | null
  documentType?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  skip?: number
  limit?: number
}

/** Texto de cada evento de la traza del comprobante. */
const EVENT_LABELS: Record<string, string> = {
  reserved: 'Número reservado',
  sent: 'Enviado a APISUNAT',
  send_failed: 'Falló el envío',
  polled: 'Consultado en SUNAT',
  accepted: 'Aceptado por SUNAT',
  rejected: 'Rechazado por SUNAT',
  exception: 'Excepción en SUNAT',
  pdf_stored: 'PDF guardado',
  void_requested: 'Anulación solicitada',
  voided: 'Anulado',
  retry: 'Reintento',
  error: 'Error al consultar'
}

export function invoiceEventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event
}
