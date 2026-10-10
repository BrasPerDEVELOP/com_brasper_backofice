import { defineStore } from 'pinia'
import axios from 'axios'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import type {
  BillingStatus,
  Invoice,
  InvoiceList,
  InvoiceListFilters,
  InvoicePreview,
  IssueInvoiceInput
} from '../../domain/models'
import { isInvoicePending } from '../../domain/models'
import { BillingApiAdapter } from '../../infrastructure/adapters/billing_api_adapter'

let adapterSingleton: BillingApiAdapter | null = null
function getAdapter(): BillingApiAdapter {
  if (!adapterSingleton) adapterSingleton = new BillingApiAdapter()
  return adapterSingleton
}

export function billingErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status
    if (status === 403) return 'No tienes permiso para esta acción.'
    if (status === 503) {
      return 'La facturación electrónica está apagada en el servidor (BILLING_ENABLED=false).'
    }
    const fromBody = formatApiErrorBody(e.response?.data)
    if (fromBody) return fromBody
    if (status === 502) return 'APISUNAT no respondió. Intenta de nuevo en unos minutos.'
  }
  if (e instanceof Error && e.message) return e.message
  return fallback
}

interface BillingState {
  status: BillingStatus | null
  statusError: string | null
  /** Último comprobante por operación (lo que pinta la tabla de Contabilidad). */
  byTransaction: Record<string, Invoice>
  loadingInvoices: boolean
  invoicesError: string | null
  list: InvoiceList
  listLoading: boolean
  listError: string | null
  requestId: number
}

export const useBillingStore = defineStore('billing', {
  state: (): BillingState => ({
    status: null,
    statusError: null,
    byTransaction: {},
    loadingInvoices: false,
    invoicesError: null,
    list: { items: [], total: 0, skip: 0, limit: 50 },
    listLoading: false,
    listError: null,
    requestId: 0
  }),

  getters: {
    invoiceFor:
      (state) =>
      (transactionId: string | null | undefined): Invoice | null =>
        (transactionId && state.byTransaction[transactionId]) || null,
    /** Operaciones cuyo comprobante sigue esperando a SUNAT. */
    pendingTransactionIds: (state): string[] =>
      Object.values(state.byTransaction)
        .filter((invoice) => isInvoicePending(invoice.status))
        .map((invoice) => invoice.transactionId)
  },

  actions: {
    async loadStatus(): Promise<void> {
      try {
        this.status = await getAdapter().getStatus()
        this.statusError = null
      } catch (e) {
        this.statusError = billingErrorMessage(e, 'No se pudo leer la configuración de facturación.')
      }
    },

    /** Trae el último comprobante de cada operación de la página (una sola petición). */
    async loadForTransactions(transactionIds: string[]): Promise<void> {
      const ids = [...new Set(transactionIds.filter(Boolean))]
      if (!ids.length) return
      const requestId = ++this.requestId
      this.loadingInvoices = true
      try {
        const invoices = await getAdapter().latestForTransactions(ids)
        if (requestId !== this.requestId) return
        const next = { ...this.byTransaction }
        for (const id of ids) delete next[id]
        for (const invoice of invoices) next[invoice.transactionId] = invoice
        this.byTransaction = next
        this.invoicesError = null
      } catch (e) {
        if (requestId !== this.requestId) return
        this.invoicesError = billingErrorMessage(e, 'No se pudieron cargar los comprobantes.')
      } finally {
        if (requestId === this.requestId) this.loadingInvoices = false
      }
    },

    remember(invoice: Invoice): Invoice {
      this.byTransaction = { ...this.byTransaction, [invoice.transactionId]: invoice }
      const index = this.list.items.findIndex((item) => item.id === invoice.id)
      if (index >= 0) {
        const items = [...this.list.items]
        items[index] = invoice
        this.list = { ...this.list, items }
      }
      return invoice
    },

    async preview(transactionId: string, input?: IssueInvoiceInput): Promise<InvoicePreview> {
      return getAdapter().previewForTransaction(transactionId, input)
    },

    async issue(transactionId: string, input?: IssueInvoiceInput): Promise<Invoice> {
      return this.remember(await getAdapter().issueForTransaction(transactionId, input))
    },

    async getInvoice(invoiceId: string): Promise<Invoice> {
      return this.remember(await getAdapter().getInvoice(invoiceId))
    },

    async refresh(invoiceId: string): Promise<Invoice> {
      return this.remember(await getAdapter().refreshInvoice(invoiceId))
    },

    /** En `rejected` el API emite un comprobante NUEVO para la misma operación. */
    async retry(invoiceId: string): Promise<Invoice> {
      return this.remember(await getAdapter().retryInvoice(invoiceId))
    },

    async voidInvoice(invoiceId: string, reason: string): Promise<Invoice> {
      return this.remember(await getAdapter().voidInvoice(invoiceId, reason))
    },

    async openPdf(invoice: Invoice): Promise<void> {
      const blob = await getAdapter().downloadPdf(invoice.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.fileName}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },

    async loadList(filters: InvoiceListFilters): Promise<void> {
      this.listLoading = true
      try {
        this.list = await getAdapter().listInvoices(filters)
        this.listError = null
      } catch (e) {
        this.listError = billingErrorMessage(e, 'No se pudo cargar el listado de comprobantes.')
      } finally {
        this.listLoading = false
      }
    }
  }
})
