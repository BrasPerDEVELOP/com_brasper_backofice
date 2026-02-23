import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  TransactionsRepository,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsParams
} from './transactions_repository'
import type { Transaction } from '../../domain/models'

function parseTransaction(item: unknown): Transaction {
  if (item == null || typeof item !== 'object') return {}
  const o = item as Record<string, unknown>
  return {
    id: o.id != null ? String(o.id) : undefined,
    bank_account_id: o.bank_account_id != null ? String(o.bank_account_id) : undefined,
    user_id: o.user_id != null ? String(o.user_id) : undefined,
    tax_rate_id: o.tax_rate_id != null ? String(o.tax_rate_id) : undefined,
    commission_id: o.commission_id != null ? String(o.commission_id) : undefined,
    status: o.status != null ? String(o.status) : undefined,
    origin_amount: typeof o.origin_amount === 'number' ? o.origin_amount : Number(o.origin_amount) || 0,
    destination_amount:
      typeof o.destination_amount === 'number' ? o.destination_amount : Number(o.destination_amount) || 0,
    code: o.code != null ? String(o.code) : undefined,
    send_date: o.send_date != null ? String(o.send_date) : undefined,
    payment_date: o.payment_date != null ? String(o.payment_date) : undefined,
    send_voucher: o.send_voucher != null ? String(o.send_voucher) : undefined,
    payment_voucher: o.payment_voucher != null ? String(o.payment_voucher) : undefined,
    created_at: o.created_at != null ? String(o.created_at) : undefined,
    created_by: o.created_by != null ? String(o.created_by) : undefined,
    updated_at: o.updated_at != null ? String(o.updated_at) : undefined
  }
}

function parseTransactions(data: unknown): Transaction[] {
  if (!Array.isArray(data)) {
    if (data != null && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
      return ((data as { data: unknown[] }).data).map(parseTransaction)
    }
    return []
  }
  return data.map(parseTransaction)
}

export class TransactionsApiAdapter implements TransactionsRepository {
  private base(): string {
    return Domain.http('transactions')
  }

  private endpoint(path: string): string {
    const base = this.base()
    return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`
  }

  async getTransactions(params?: GetTransactionsParams): Promise<Transaction[]> {
    let url = this.endpoint('')
    const search = new URLSearchParams()
    if (params?.status?.trim()) search.set('status', params.status.trim())
    if (params?.user_id?.trim()) search.set('user_id', params.user_id.trim())
    if (params?.bank_account_id?.trim()) search.set('bank_account_id', params.bank_account_id.trim())
    if (params?.created_at_from?.trim()) search.set('created_at_from', params.created_at_from.trim())
    if (params?.created_at_to?.trim()) search.set('created_at_to', params.created_at_to.trim())
    const qs = search.toString()
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
    const response = await apiClient.get<unknown>(url)
    const raw = response.data
    const data = Array.isArray(raw)
      ? raw
      : (raw != null && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data))
        ? (raw as { data: unknown[] }).data
        : []
    return parseTransactions(data)
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    const url = this.endpoint(`${id}/`)
    try {
      const response = await apiClient.get<unknown>(url)
      const raw = response.data
      const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const item = (obj.data ?? obj) as Record<string, unknown>
      return parseTransaction(item)
    } catch {
      return null
    }
  }

  async createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
    const url = this.endpoint('')
    const response = await apiClient.post<unknown>(url, payload)
    const raw = response.data
    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return parseTransaction(item)
  }

  async updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Transaction> {
    const url = this.endpoint(`${id}/`)
    const response = await apiClient.put<unknown>(url, payload)
    const raw = response.data
    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return parseTransaction(item)
  }

  async deleteTransaction(id: string): Promise<void> {
    const url = this.endpoint(`${id}/`)
    await apiClient.delete(url)
  }

  async importFromExcel(file: File): Promise<unknown> {
    const url = this.endpoint('import-excel')
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }
}
