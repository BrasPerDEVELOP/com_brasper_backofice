import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  ComisionesRepository,
  CommissionCreateBody,
  CommissionUpdateBody
} from './comisiones_repository'
import type { Commission, CommissionHistoryEntry, CommissionResource } from '../../domain/models'

/**
 * `max_amount` nulo o ausente significa "sin límite superior" y se conserva
 * como `null`. Antes se convertía a `0`, lo que rompía el tramo "a más":
 * la calculadora nunca lo elegía y editarlo lo guardaba con máximo 0.
 */
function parseOptionalAmount(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

function parseCommission(item: Record<string, unknown>): Commission {
  const percentage = Number(item.percentage ?? 0)
  const minAmount = Number(item.min_amount ?? 0)
  return {
    id: String(item.id ?? ''),
    coin_a: String(item.coin_a ?? '').toUpperCase(),
    coin_b: String(item.coin_b ?? '').toUpperCase(),
    percentage: Number.isNaN(percentage) ? 0 : percentage,
    reverse: String(item.reverse ?? '0'),
    min_amount: Number.isNaN(minAmount) ? 0 : minAmount,
    max_amount: parseOptionalAmount(item.max_amount),
    created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
    created_by: item.created_by === null ? null : String(item.created_by ?? ''),
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : undefined
  }
}

function parseCommissions(data: unknown): Commission[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map(parseCommission)
    .filter((c) => c.id && c.coin_a && c.coin_b)
}

function parseCommissionHistory(data: unknown): CommissionHistoryEntry[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item, index) => ({
      ...item,
      id: String(item.id ?? item.history_id ?? item.updated_at ?? item.created_at ?? index)
    }))
}

export class ComisionesApiAdapter implements ComisionesRepository {
  /**
   * @param resource recurso de comisiones al que apunta este adapter. Por
   * defecto las comisiones de venta, para no cambiar a los llamadores previos.
   */
  constructor(private readonly resource: CommissionResource = 'commission') {}

  /** `''` → `coin/<recurso>`; `'<id>/history'` → `coin/<recurso>/<id>/history`. */
  private endpoint(path = ''): string {
    const suffix = path.replace(/^\/+/, '')
    return Domain.apiPath(suffix ? `coin/${this.resource}/${suffix}` : `coin/${this.resource}`)
  }

  async getCommissions(): Promise<Commission[]> {
    const url = this.endpoint()
    const response = await apiClient.get<unknown>(url)
    const data = Array.isArray(response.data) ? response.data : []
    return parseCommissions(data)
  }

  async createCommission(payload: CommissionCreateBody): Promise<Commission> {
    const url = this.endpoint()
    const response = await apiClient.post<unknown>(url, payload)
    return parseCommission(
      response.data != null && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : { id: '', ...payload }
    )
  }

  async updateCommission(id: string, body: CommissionUpdateBody): Promise<Commission> {
    const url = this.endpoint()
    const requestBody: CommissionUpdateBody = { ...body, id }
    const response = await apiClient.put<unknown>(url, requestBody)
    return parseCommission(
      response.data != null && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : (requestBody as unknown as Record<string, unknown>)
    )
  }

  async deleteCommission(id: string): Promise<void> {
    const url = this.endpoint(id)
    await apiClient.delete(url)
  }

  async getCommissionHistory(id: string): Promise<CommissionHistoryEntry[]> {
    const url = this.endpoint(`${id}/history`)
    const response = await apiClient.get<unknown>(url)
    return parseCommissionHistory(response.data)
  }
}
