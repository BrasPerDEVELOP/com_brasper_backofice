import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'

export interface BankOption {
  id: string
  bank: string
  currency: string
  country: string
}

function parseBank(item: unknown): BankOption | null {
  if (item == null || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const id = o.id != null ? String(o.id) : ''
  const bank = (o.bank ?? o.name ?? o.bank_name ?? '').toString().trim()
  if (!id) return null
  return {
    id,
    bank: bank || id,
    currency: o.currency != null ? String(o.currency) : '',
    country: o.country != null ? String(o.country) : ''
  }
}

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw != null && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const arr = obj.data ?? obj.results ?? obj.items ?? obj.banks
    if (Array.isArray(arr)) return arr
  }
  return []
}

export async function fetchBankNames(): Promise<BankOption[]> {
  const url = Domain.http('transactions/banks/names')
  const response = await apiClient.get<unknown>(url)
  const arr = extractArray(response.data)
  return arr.map(parseBank).filter((b): b is BankOption => b != null)
}
