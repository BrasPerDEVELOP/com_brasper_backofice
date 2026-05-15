import axios from 'axios'
import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import { formatApiErrorBody } from '@/interface/api/format_api_error'

export interface BankOption {
  id: string
  bank: string
  currency: string
  country: string
  account?: string | null
  pix?: string | null
  company?: string | null
  image?: string | null
  currency_display?: string | null
  social_actor?: string | null
  created_at?: string
  created_by?: string | null
  updated_at?: string
}

export type CreateBankBody = {
  bank: string
  currency: string
  country: string
  company: string | null
  account: string | null
  pix: string | null
  image?: string | null
  social_actor?: string | null
}

export type UpdateBankBody = Partial<CreateBankBody>

function banksBaseUrl(): string {
  return Domain.http('transactions/banks/')
}

function bankDetailUrl(id: string): string {
  const base = banksBaseUrl()
  const trimmed = id.replace(/\/$/, '')
  return base.endsWith('/') ? `${base}${trimmed}/` : `${base}/${trimmed}/`
}

function parseBank(item: unknown): BankOption | null {
  if (item == null || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const rawId = o.id ?? o.uuid ?? o.pk ?? o.bank_id
  const id = rawId != null ? String(rawId) : ''
  const bank = (o.bank ?? o.name ?? o.bank_name ?? '').toString().trim()
  if (!id) return null
  const companyFromApi = [o.company, o.razon_social, o.company_name]
    .map((v) => (v != null && v !== '' ? String(v).trim() : ''))
    .find((s) => s.length > 0)
  return {
    id,
    bank: bank || id,
    currency: o.currency != null ? String(o.currency) : '',
    country: o.country != null ? String(o.country) : '',
    account: o.account === undefined ? undefined : o.account === null ? null : String(o.account),
    pix: o.pix === undefined ? undefined : o.pix === null ? null : String(o.pix),
    company: companyFromApi ?? (o.company === null ? null : undefined),
    image: o.image === undefined ? undefined : o.image === null ? null : String(o.image),
    currency_display:
      o.currency_display === undefined
        ? undefined
        : o.currency_display === null
          ? null
          : String(o.currency_display),
    social_actor:
      o.social_actor === undefined
        ? undefined
        : o.social_actor === null
          ? null
          : String(o.social_actor),
    created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
    created_by: o.created_by === null ? null : o.created_by != null ? String(o.created_by) : undefined,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined
  }
}

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw != null && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const candidates = [
      obj.data,
      obj.results,
      obj.items,
      obj.banks,
      obj.names,
      obj.records
    ]
    for (const c of candidates) {
      if (Array.isArray(c)) return c
      if (c != null && typeof c === 'object' && !Array.isArray(c)) {
        const nested = extractArray(c)
        if (nested.length) return nested
      }
    }
  }
  return []
}

/** POST/PATCH a veces devuelven el recurso envuelto en `{ data: { ... } }`. */
function unwrapBankPayload(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw
  const o = raw as Record<string, unknown>
  const inner = o.data
  if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) return inner
  return raw
}

function assertBank(item: unknown): BankOption {
  const b = parseBank(item)
  if (!b) throw new Error('Respuesta de banco inválida')
  return b
}

function errorFromAxios(e: unknown, fallback: string): Error {
  if (axios.isAxiosError(e)) {
    const msg = formatApiErrorBody(e.response?.data) ?? e.message
    return new Error(msg || fallback)
  }
  if (e instanceof Error) return e
  return new Error(fallback)
}

export async function fetchBanks(): Promise<BankOption[]> {
  const url = banksBaseUrl()
  const response = await apiClient.get<unknown>(url)
  const arr = extractArray(response.data)
  return arr.map(parseBank).filter((b): b is BankOption => b != null)
}

/** @deprecated Use fetchBanks; mantiene compatibilidad con código que llamaba /names. */
export async function fetchBankNames(): Promise<BankOption[]> {
  return fetchBanks()
}

export async function createBank(body: CreateBankBody): Promise<BankOption> {
  try {
    const response = await apiClient.post<unknown>(banksBaseUrl(), body)
    return assertBank(unwrapBankPayload(response.data))
  } catch (e) {
    throw errorFromAxios(e, 'Error al crear banco')
  }
}

export async function updateBank(id: string, body: UpdateBankBody): Promise<BankOption> {
  try {
    const response = await apiClient.patch<unknown>(bankDetailUrl(id), body)
    return assertBank(unwrapBankPayload(response.data))
  } catch (e) {
    throw errorFromAxios(e, 'Error al actualizar banco')
  }
}

export async function deleteBank(id: string): Promise<void> {
  try {
    await apiClient.delete(bankDetailUrl(id))
  } catch (e) {
    throw errorFromAxios(e, 'Error al eliminar banco')
  }
}
