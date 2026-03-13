import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { Coupon } from '../../domain/models'
import type { CouponPayload, CouponUpdatePayload, CuponesRepository } from './cupones_repository'

function parseCoupon(item: unknown): Coupon {
  if (item == null || typeof item !== 'object') {
    return {
      id: '',
      code: '',
      discount_percentage: 0,
      max_uses: 0,
      origin_currency: '',
      destination_currency: '',
      start_date: '',
      end_date: '',
      is_active: false
    }
  }

  const o = item as Record<string, unknown>
  const discountPercentage = Number(o.discount_percentage ?? 0)
  const maxUses = Number(o.max_uses ?? 0)

  return {
    id: String(o.id ?? ''),
    code: String(o.code ?? '').toUpperCase(),
    discount_percentage: Number.isNaN(discountPercentage) ? 0 : discountPercentage,
    max_uses: Number.isNaN(maxUses) ? 0 : maxUses,
    origin_currency: String(o.origin_currency ?? '').toUpperCase(),
    destination_currency: String(o.destination_currency ?? '').toUpperCase(),
    start_date: String(o.start_date ?? ''),
    end_date: String(o.end_date ?? ''),
    is_active: Boolean(o.is_active),
    created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
    created_by: typeof o.created_by === 'string' ? o.created_by : undefined,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined
  }
}

function parseCoupons(data: unknown): Coupon[] {
  if (!Array.isArray(data)) return []
  return data.map(parseCoupon).filter((coupon) => coupon.id && coupon.code)
}

export class CuponesApiAdapter implements CuponesRepository {
  private base(): string {
    return Domain.http('transactions/coupons')
  }

  private endpoint(path = ''): string {
    const base = this.base()
    return path ? (base.endsWith('/') ? `${base}${path}` : `${base}/${path}`) : `${base}/`
  }

  async getCoupons(): Promise<Coupon[]> {
    const response = await apiClient.get<unknown>(this.endpoint())
    return parseCoupons(response.data)
  }

  async createCoupon(payload: CouponPayload): Promise<Coupon> {
    const response = await apiClient.post<unknown>(this.endpoint(), payload)
    return parseCoupon(response.data)
  }

  async updateCoupon(payload: CouponUpdatePayload): Promise<Coupon> {
    const response = await apiClient.put<unknown>(this.endpoint(), payload)
    return parseCoupon(response.data)
  }
}
