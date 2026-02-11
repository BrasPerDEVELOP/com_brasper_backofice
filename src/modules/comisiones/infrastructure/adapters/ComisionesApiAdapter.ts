import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { ComisionesRepository } from './ComisionesRepository'
import type { Commission } from '../../domain/models'

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

export class ComisionesApiAdapter implements ComisionesRepository {
  private base(): string {
    return Domain.http('coin')
  }

  async getCommissions(): Promise<Commission[]> {
    const url = `${this.base()}/commission`
    const response = await apiClient.get<unknown>(url)
    const data = Array.isArray(response.data) ? response.data : []
    return parseCommissions(data)
  }
}
