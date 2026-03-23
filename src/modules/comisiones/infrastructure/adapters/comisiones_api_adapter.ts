import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { ComisionesRepository } from './comisiones_repository'
import type { Commission, CommissionHistoryEntry } from '../../domain/models'

function parseCommission(item: Record<string, unknown>): Commission {
  const percentage = Number(item.percentage ?? 0)
  const minAmount = Number(item.min_amount ?? 0)
  const maxAmount = Number(item.max_amount ?? 0)
  return {
    id: String(item.id ?? ''),
    coin_a: String(item.coin_a ?? '').toUpperCase(),
    coin_b: String(item.coin_b ?? '').toUpperCase(),
    percentage: Number.isNaN(percentage) ? 0 : percentage,
    reverse: String(item.reverse ?? '0'),
    min_amount: Number.isNaN(minAmount) ? 0 : minAmount,
    max_amount: Number.isNaN(maxAmount) ? 0 : maxAmount,
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
  private base(): string {
    return Domain.http('coin')
  }

  private endpoint(path: string): string {
    const base = this.base()
    return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`
  }

  async getCommissions(): Promise<Commission[]> {
    const url = this.endpoint('commission')
    const response = await apiClient.get<unknown>(url)
    const data = Array.isArray(response.data) ? response.data : []
    return parseCommissions(data)
  }

  async createCommission(payload: {
    coin_a: string
    coin_b: string
    percentage: string
    reverse: string
    min_amount: string
    max_amount: string
  }): Promise<Commission> {
    const url = this.endpoint('commission')
    const response = await apiClient.post<unknown>(url, payload)
    return parseCommission(
      response.data != null && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : {
            id: '',
            ...payload
          }
    )
  }

  async updateCommission(
    id: string,
    body: import('./comisiones_repository').CommissionUpdateBody
  ): Promise<Commission> {
    const url = this.endpoint('commission')
    const requestBody: import('./comisiones_repository').CommissionUpdateBody = { ...body }
    requestBody.id = id
    const response = await apiClient.put<unknown>(url, requestBody)
    return parseCommission(
      response.data != null && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : (requestBody as unknown as Record<string, unknown>)
    )
  }

  async deleteCommission(id: string): Promise<void> {
    const url = this.endpoint(`commission/${id}`)
    await apiClient.delete(url)
  }

  async getCommissionHistory(id: string): Promise<CommissionHistoryEntry[]> {
    const url = this.endpoint(`commission/${id}/history`)
    const response = await apiClient.get<unknown>(url)
    return parseCommissionHistory(response.data)
  }
}
