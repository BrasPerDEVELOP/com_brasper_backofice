import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { TasasRepository } from './TasasRepository'
import type { TaxRate } from '../../domain/models'

function parseTaxRate(item: Record<string, unknown>): TaxRate {
  const tax = Number(item.tax ?? 0)
  return {
    id: String(item.id ?? ''),
    coin_a: String(item.coin_a ?? '').toUpperCase(),
    coin_b: String(item.coin_b ?? '').toUpperCase(),
    tax: Number.isNaN(tax) ? 0 : tax,
    created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : undefined
  }
}

function parseTaxRates(data: unknown): TaxRate[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map(parseTaxRate)
    .filter((r) => r.id && r.coin_a && r.coin_b)
}

export class TasasApiAdapter implements TasasRepository {
  private base(): string {
    return Domain.http('coin')
  }

  async getTaxRates(): Promise<TaxRate[]> {
    const url = `${this.base()}/tax-rate`
    const response = await apiClient.get<unknown>(url)
    const data = Array.isArray(response.data) ? response.data : []
    return parseTaxRates(data)
  }

  async updateTaxRate(
    id: string,
    payload: { coin_a: string; coin_b: string; tax: string }
  ): Promise<TaxRate> {
    const url = `${this.base()}/tax-rate/${id}`
    try {
      const response = await apiClient.patch<unknown>(url, payload)
      return parseTaxRate(
        response.data != null && typeof response.data === 'object'
          ? (response.data as Record<string, unknown>)
          : { id, ...payload, tax: Number(payload.tax) }
      )
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 405) {
        throw new Error('La API no permite modificar tasas desde esta aplicación.')
      }
      throw err
    }
  }

  async createTaxRate(payload: {
    coin_a: string
    coin_b: string
    tax: string
  }): Promise<TaxRate> {
    const url = `${this.base()}/tax-rate`
    try {
      const response = await apiClient.post<unknown>(url, payload)
      return parseTaxRate(
        response.data != null && typeof response.data === 'object'
          ? (response.data as Record<string, unknown>)
          : { id: '', ...payload, tax: Number(payload.tax) }
      )
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 405) {
        throw new Error('La API no permite agregar nuevas tasas desde esta aplicación.')
      }
      throw err
    }
  }
}
