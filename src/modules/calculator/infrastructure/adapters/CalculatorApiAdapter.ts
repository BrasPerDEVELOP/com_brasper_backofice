import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { CalculatorRepository, CurrencyReadDTO } from './CalculatorRepository'
import type { ExchangeRate, CommissionRange, Coupon } from '../../domain/models'
import { getCurrencyPairKey } from '../../domain/models'

function parseCurrencies(data: unknown): CurrencyReadDTO[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      code: String(item.code ?? '').toLowerCase(),
      name: String(item.name ?? ''),
      symbol: String(item.symbol ?? '')
    }))
    .filter((c) => c.code)
}

function parseTaxRates(data: unknown): ExchangeRate[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => {
      const coinA = String(item.coin_a ?? '').toLowerCase()
      const coinB = String(item.coin_b ?? '').toLowerCase()
      const tax = Number(item.tax ?? 0)
      const pair = getCurrencyPairKey(coinA as ExchangeRate['from'], coinB as ExchangeRate['to'])
      return {
        id: String(item.id ?? ''),
        pair,
        rate: tax,
        from: coinA as ExchangeRate['from'],
        to: coinB as ExchangeRate['to']
      }
    })
    .filter((r) => r.rate > 0 && r.id)
}

function parseCommissions(data: unknown): CommissionRange[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      coin_a: String(item.coin_a ?? '').toLowerCase() as CommissionRange['coin_a'],
      coin_b: String(item.coin_b ?? '').toLowerCase() as CommissionRange['coin_b'],
      percentage: Number(item.percentage ?? 0),
      reverse: Boolean(item.reverse ?? false),
      min_amount: Number(item.min_amount ?? 0),
      max_amount: Number(item.max_amount ?? 0)
    }))
    .filter((c) => c.id)
}

function parseCoupons(data: unknown): Coupon[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      code: String(item.code ?? ''),
      discount: Number(item.discount ?? 0),
      type: (item.type === 'fixed' ? 'fixed' : 'percent') as Coupon['type'],
      isAutomatic: Boolean(item.isAutomatic ?? item.is_automatic)
    }))
    .filter((c) => c.id)
}

export class CalculatorApiAdapter implements CalculatorRepository {
  constructor(private readonly useDemo = false) {}

  private coinBase(): string {
    return this.useDemo ? Domain.http('coin/demo') : Domain.http('coin')
  }

  private transactionsBase(): string {
    return this.useDemo ? Domain.http('transactions/demo') : Domain.http('transactions')
  }

  private endpoint(suffix: string): string {
    const base = this.coinBase()
    const path = this.useDemo ? `${suffix}-trial` : suffix
    return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`
  }

  async getCurrencies(): Promise<CurrencyReadDTO[]> {
    const url = this.endpoint('currencies')
    const response = await apiClient.get<unknown>(url).catch(() => ({ data: [] }))
    return parseCurrencies(response.data ?? [])
  }

  async getTaxRates(): Promise<ExchangeRate[]> {
    const url = this.endpoint('tax-rate')
    const response = await apiClient.get<unknown>(url).catch(() => ({ data: [] }))
    return parseTaxRates(Array.isArray(response.data) ? response.data : [])
  }

  async getCommissions(): Promise<CommissionRange[]> {
    const url = this.endpoint('commission')
    const response = await apiClient.get<unknown>(url).catch(() => ({ data: [] }))
    return parseCommissions(Array.isArray(response.data) ? response.data : [])
  }

  async getAutomaticCoupons(): Promise<Coupon[]> {
    const base = this.transactionsBase()
    const path = this.useDemo ? 'coupons/automatic-trial/' : 'coupons/automatic/'
    const url = base.endsWith('/') ? `${base}${path}` : `${base}/${path}`
    const response = await apiClient.get<unknown>(url).catch(() => ({ data: [] }))
    return parseCoupons(response.data ?? [])
  }
}
