import {
  apiClient,
  getApiAuthHeaders,
  triggerUnauthorized
} from '@/interface/api/client'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import { Domain } from '@/interface/infrastructure/services'
import { env } from '@/interface/config/env'
import type {
  TransactionsRepository,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsParams,
  PagedTransactions,
  TransactionMetrics
} from './transactions_repository'
import type { Transaction } from '../../domain/models'
import { extractTotalFromApiPayload } from '../utils/transactions_api_list'
import {
  transactionFromApiRecord,
  normalizeAttachmentValues
} from '../mappers/parse_transaction'
import { parseTransactions } from '../mappers/transaction_list_response'
import {
  appendFormValue,
  appendAttachmentValues
} from '../mappers/transaction_form_payload'

export class TransactionsApiAdapter implements TransactionsRepository {
  private endpoint(path: string): string {
    const p = path.replace(/^\/+/, '')
    return p ? Domain.apiPath(`transactions/${p}`) : Domain.apiPath('transactions/')
  }

  async getTransactions(params?: GetTransactionsParams): Promise<PagedTransactions> {
    let url = this.endpoint('')
    const search = new URLSearchParams()
    if (params?.status?.trim()) search.set('status', params.status.trim())
    if (params?.user_id?.trim()) search.set('user_id', params.user_id.trim())
    if (params?.bank_account_origin_id?.trim())
      search.set('bank_account_origin_id', params.bank_account_origin_id.trim())
    if (params?.bank_account_destination_id?.trim())
      search.set('bank_account_destination_id', params.bank_account_destination_id.trim())
    if (params?.bank_account_id?.trim()) search.set('bank_account_id', params.bank_account_id.trim())
    if (params?.created_at_from?.trim()) search.set('created_at_from', params.created_at_from.trim())
    if (params?.created_at_to?.trim()) search.set('created_at_to', params.created_at_to.trim())
    if (params?.send_date_from?.trim()) search.set('send_date_from', params.send_date_from.trim())
    if (params?.send_date_to?.trim()) search.set('send_date_to', params.send_date_to.trim())
    if (params?.search?.trim()) search.set('search', params.search.trim())
    if (params?.currency?.trim()) search.set('currency', params.currency.trim())
    if (params?.origin_currency?.trim())
      search.set('origin_currency', params.origin_currency.trim())
    if (params?.destination_currency?.trim())
      search.set('destination_currency', params.destination_currency.trim())
    if (typeof params?.skip === 'number' && params.skip >= 0)
      search.set('skip', String(params.skip))
    if (typeof params?.limit === 'number' && params.limit > 0)
      search.set('limit', String(params.limit))
    const qs = search.toString()
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
    const response = await apiClient.get<unknown>(url)
    const raw = response.data
    if (typeof raw === 'string' && raw.trim().startsWith('<')) {
      throw new Error(
        'El servidor devolvió HTML en lugar de JSON al listar transacciones.',
      )
    }
    const items = parseTransactions(raw)
    const total = extractTotalFromApiPayload(raw, items.length)
    return { items, total }
  }

  async getTransactionMetrics(): Promise<TransactionMetrics> {
    const url = this.endpoint('metrics')
    const response = await apiClient.get<unknown>(url)
    const raw =
      response.data != null && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : {}
    const byStatus =
      raw.by_status != null && typeof raw.by_status === 'object'
        ? (raw.by_status as Record<string, number>)
        : {}
    return {
      total: Number(raw.total) || 0,
      by_status: byStatus,
      volume_origin: Number(raw.volume_origin) || 0,
      volume_destination: Number(raw.volume_destination) || 0,
      last_7_days: Number(raw.last_7_days) || 0,
    }
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    const url = this.endpoint(`${id}`)
    try {
      const response = await apiClient.get<unknown>(url)
      const raw = response.data
      const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const item = (obj.data ?? obj) as Record<string, unknown>
      return transactionFromApiRecord(item)
    } catch {
      return null
    }
  }

  async createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
    const formData = new FormData()
    if (payload.bank_account_origin?.trim()) {
      formData.append('bank_account_origin', payload.bank_account_origin.trim())
    }
    formData.append('bank_account_destination', payload.bank_account_destination)
    formData.append('user_id', payload.user_id)
    if (payload.agent_id != null && payload.agent_id !== '') {
      formData.append('agent_id', payload.agent_id)
    }
    formData.append('tax_rate_id', payload.tax_rate_id)
    formData.append('commission_id', payload.commission_id)
    formData.append('origin_amount', String(payload.origin_amount))
    formData.append('destination_amount', String(payload.destination_amount))
    formData.append('code', payload.code)
    if (payload.operation_number?.trim()) {
      formData.append('operation_number', payload.operation_number.trim())
    }
    if (payload.status?.trim()) {
      formData.append('status', payload.status.trim())
    }
    if (payload.checked != null) {
      formData.append('checked', payload.checked ? 'true' : 'false')
    }
    if (payload.resultado_comision != null) {
      formData.append('resultado_comision', String(payload.resultado_comision))
      formData.append('commission_result', String(payload.resultado_comision))
    }
    if (payload.total_a_enviar != null) {
      formData.append('total_a_enviar', String(payload.total_a_enviar))
      formData.append('total_to_send', String(payload.total_a_enviar))
    }
    if (payload.tax_amount != null) {
      formData.append('tax_amount', String(payload.tax_amount))
    }
    appendAttachmentValues(formData, 'send_voucher', payload.send_voucher)
    appendAttachmentValues(formData, 'payment_voucher', payload.payment_voucher)
    appendAttachmentValues(formData, 'checked_image', payload.checked_image)
    if (payload.coupon_id != null && String(payload.coupon_id).trim())
      formData.append('coupon_id', String(payload.coupon_id).trim())
    if (payload.coupon_discount_code?.trim())
      formData.append('coupon_discount_code', payload.coupon_discount_code.trim())
    if (payload.coupon_origin_amount != null)
      formData.append('coupon_origin_amount', String(payload.coupon_origin_amount))
    if (payload.coupon_destination_amount != null)
      formData.append('coupon_destination_amount', String(payload.coupon_destination_amount))
    if (payload.coupon_discount_percentage != null)
      formData.append('coupon_discount_percentage', String(payload.coupon_discount_percentage))
    if (payload.coupon_discount_commission != null)
      formData.append('coupon_discount_commission', String(payload.coupon_discount_commission))
    if (payload.coupon_discount_total_to_send != null)
      formData.append('coupon_discount_total_to_send', String(payload.coupon_discount_total_to_send))
    if (payload.bank_id?.trim()) {
      formData.append('bank_id', payload.bank_id.trim())
    }
    if (payload.bank_name != null) {
      formData.append('bank_name', String(payload.bank_name))
    }
    if (payload.company_name != null) {
      formData.append('company_name', String(payload.company_name))
    }
    if (payload.social_reason_bank_id?.trim()) {
      formData.append('social_reason_bank_id', payload.social_reason_bank_id.trim())
    }

    /**
     * `fetch` + FormData evita que axios 1.x deje `Content-Type: application/json`
     * y corrompa el multipart (400 del servidor al subir archivos).
     */
    const res = await fetch(Domain.apiUrl(this.endpoint('')), {
      method: 'POST',
      body: formData,
      headers: getApiAuthHeaders()
    })

    const ct = res.headers.get('content-type') ?? ''
    let raw: unknown = null
    if (ct.includes('application/json')) {
      raw = await res.json().catch(() => null)
    } else {
      const text = await res.text().catch(() => '')
      if (text) {
        try {
          raw = JSON.parse(text)
        } catch {
          raw = text
        }
      }
    }

    if (res.status === 401) {
      triggerUnauthorized()
      throw new Error('Sesión expirada o no autorizado')
    }

    if (!res.ok) {
      const msg =
        formatApiErrorBody(raw) ?? `Error al crear transacción (${res.status})`
      throw new Error(msg)
    }

    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return transactionFromApiRecord(item)
  }

  async updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Transaction> {
    // Backend espera PUT /transactions/ con id en el body (no PUT /transactions/{id}/)
    const url = this.endpoint('')
    const body: Record<string, unknown> = { id: id.trim() }
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) continue
      body[key] = value
    }
    if (body.resultado_comision != null) {
      body.commission_result = body.resultado_comision
    }
    if (body.total_a_enviar != null) {
      body.total_to_send = body.total_a_enviar
    }
    if (typeof body.social_reason_bank_id === 'string') {
      const socialReasonBankId = body.social_reason_bank_id.trim()
      if (socialReasonBankId) body.social_reason_bank_id = socialReasonBankId
      else body.social_reason_bank_id = null
    }
    /**
     * El servidor recalcula `status`, pero permitimos enviar estados terminales
     * explícitos desde UI cuando el flujo operativo ya los determinó.
     */
    if (
      body.status !== undefined &&
      typeof body.status === 'string' &&
      !['failed', 'completed'].includes(body.status.toLowerCase().trim())
    ) {
      delete body.status
    }
    const hasFileUpload = Object.values(body).some((value) =>
      normalizeAttachmentValues(value).some((item) => item instanceof File)
    )
    const requestPayload = hasFileUpload
      ? (() => {
          const form = new FormData()
          for (const [key, value] of Object.entries(body)) {
            appendFormValue(form, key, value)
          }
          return form
        })()
      : body

    const response = await apiClient.put<unknown>(url, requestPayload)
    const raw = response.data
    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return transactionFromApiRecord(item)
  }

  async deleteTransaction(id: string): Promise<void> {
    const url = this.endpoint(`${id}/`)
    await apiClient.delete(url)
  }

  async importFromExcel(file: File): Promise<unknown> {
    const path = env.transactionsImportPath
    const url = path ? Domain.apiPath(path) : this.endpoint('import/')
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    let payload: { items: unknown[] }

    if (ext === 'json') {
      const { jsonFileToImportPayload } = await import('../utils/excel_to_import_json')
      payload = await jsonFileToImportPayload(file)
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const { excelBrasperToImportPayload } = await import('../utils/excel_brasper_format')
        payload = await excelBrasperToImportPayload(file)
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('formato Brasper')) {
          const { excelToImportJson } = await import('../utils/excel_to_import_json')
          payload = await excelToImportJson(file)
        } else {
          throw e
        }
      }
    } else {
      throw new Error('Formato no soportado. Use .json, .xlsx o .xls')
    }

    const response = await apiClient.post(url, payload)
    return response.data
  }
}
