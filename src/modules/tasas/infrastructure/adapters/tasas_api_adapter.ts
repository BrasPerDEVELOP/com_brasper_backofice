import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { TasasRepository } from './tasas_repository'
import type { TaxRate, TaxRateHistoryEntry } from '../../domain/models'

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

function parseTaxRateHistory(data: unknown): TaxRateHistoryEntry[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item, index) => ({
      ...item,
      id: String(item.id ?? item.history_id ?? item.updated_at ?? item.created_at ?? index)
    }))
}

export class TasasApiAdapter implements TasasRepository {
  private base(): string {
    return Domain.http('coin')
  }

  private endpoint(path: string): string {
    const base = this.base()
    return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`
  }

  async getTaxRates(): Promise<TaxRate[]> {
    const url = this.endpoint('tax-rate/')
    const response = await apiClient.get<unknown>(url)
    const data = Array.isArray(response.data) ? response.data : []
    return parseTaxRates(data)
  }

  async updateTaxRate(
    id: string,
    payload: { coin_a: string; coin_b: string; tax: string }
  ): Promise<TaxRate> {
    const url = this.endpoint('tax-rate/')
    const body = { ...payload, id }
    try {
      const response = await apiClient.put<unknown>(url, body)
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

  async deleteTaxRate(id: string): Promise<void> {
    const url = this.endpoint(`tax-rate/${id}/`)
    await apiClient.delete(url)
  }

  async createTaxRate(payload: {
    coin_a: string
    coin_b: string
    tax: string
  }): Promise<TaxRate> {
    const url = this.endpoint('tax-rate/')
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

  async getTaxRateHistory(id: string): Promise<TaxRateHistoryEntry[]> {
    const url = this.endpoint(`tax-rate/${id}/history`)
    const response = await apiClient.get<unknown>(url)
    return parseTaxRateHistory(response.data)
  }
}
