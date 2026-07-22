import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  CuentasBancariasRepository,
  CreateBankAccountPayload,
  GetBankAccountsParams,
  UpdateBankAccountPayload
} from './cuentas_bancarias_repository'
import type { BankAccount } from '../../domain/models'

function parseBankAccount(item: Record<string, unknown>): BankAccount {
  return {
    id: String(item.id ?? ''),
    user_id: String(item.user_id ?? ''),
    bank_id: String(item.bank_id ?? ''),
    account_flow: String(item.account_flow ?? ''),
    account_holder_type: String(item.account_holder_type ?? ''),
    bank_country: String(item.bank_country ?? ''),
    holder_names: item.holder_names != null ? String(item.holder_names) : null,
    holder_surnames: item.holder_surnames != null ? String(item.holder_surnames) : null,
    document_number: item.document_number != null ? String(item.document_number) : null,
    business_name: item.business_name != null ? String(item.business_name) : null,
    ruc_number: item.ruc_number != null ? String(item.ruc_number) : null,
    legal_representative_name:
      item.legal_representative_name != null ? String(item.legal_representative_name) : null,
    legal_representative_document:
      item.legal_representative_document != null ? String(item.legal_representative_document) : null,
    account_number: item.account_number != null ? String(item.account_number) : null,
    account_number_confirmation:
      item.account_number_confirmation != null ? String(item.account_number_confirmation) : null,
    cci_number: item.cci_number != null ? String(item.cci_number) : null,
    cci_number_confirmation:
      item.cci_number_confirmation != null ? String(item.cci_number_confirmation) : null,
    pix_key: item.pix_key != null ? String(item.pix_key) : null,
    pix_key_confirmation: item.pix_key_confirmation != null ? String(item.pix_key_confirmation) : null,
    pix_key_type: item.pix_key_type != null ? String(item.pix_key_type) : null,
    cpf: item.cpf != null ? String(item.cpf) : null,
    created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
    created_by: item.created_by === null ? null : String(item.created_by ?? ''),
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : undefined
  }
}

function parseBankAccounts(data: unknown): BankAccount[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map(parseBankAccount)
}

function extractBankAccountsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw == null || typeof raw !== 'object') return []

  const obj = raw as Record<string, unknown>
  const candidates = [
    obj.data,
    obj.results,
    obj.items,
    obj.bank_accounts,
    obj.accounts,
    obj.records
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
    if (candidate != null && typeof candidate === 'object') {
      const nested = extractBankAccountsArray(candidate)
      if (nested.length) return nested
    }
  }

  return []
}

function extractNextPage(raw: unknown): string | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const direct = obj.next ?? obj.next_page ?? obj.nextPage
  if (typeof direct === 'string' && direct.trim()) return direct
  const pagination = obj.pagination
  if (pagination != null && typeof pagination === 'object' && !Array.isArray(pagination)) {
    const nested = (pagination as Record<string, unknown>).next
    if (typeof nested === 'string' && nested.trim()) return nested
  }
  return null
}

export class CuentasBancariasApiAdapter implements CuentasBancariasRepository {
  private endpoint(path: string): string {
    const p = path.replace(/^\/+/, '')
    return p
      ? Domain.apiPath(`transactions/bank-accounts/${p}`)
      : Domain.apiPath('transactions/bank-accounts/')
  }

  async getBankAccounts(params?: GetBankAccountsParams): Promise<BankAccount[]> {
    let url = this.endpoint('')
    const search = new URLSearchParams()
    if (params?.userId) search.set('user_id', params.userId)
    if (params?.bank_country) search.set('bank_country', params.bank_country)
    if (params?.account_flow) search.set('account_flow', params.account_flow)
    const qs = search.toString()
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
    const accounts: BankAccount[] = []
    const seenPages = new Set<string>()
    let nextUrl: string | null = url
    while (nextUrl && !seenPages.has(nextUrl)) {
      seenPages.add(nextUrl)
      const response = await apiClient.get<unknown>(nextUrl)
      accounts.push(...parseBankAccounts(extractBankAccountsArray(response.data)))
      nextUrl = extractNextPage(response.data)
    }
    return accounts
  }

  async createBankAccount(payload: CreateBankAccountPayload): Promise<BankAccount> {
    const url = this.endpoint('')
    const response = await apiClient.post<unknown>(url, payload)
    const raw = response.data
    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return parseBankAccount(item)
  }

  /** El backend espera el `id` en el body, no en la URL. */
  async updateBankAccount(payload: UpdateBankAccountPayload): Promise<BankAccount> {
    const url = this.endpoint('')
    const response = await apiClient.put<unknown>(url, payload)
    const raw = response.data
    const obj = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const item = (obj.data ?? obj) as Record<string, unknown>
    return parseBankAccount(item)
  }
}
