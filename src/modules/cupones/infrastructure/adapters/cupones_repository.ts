import type { Coupon } from '../../domain/models'

export interface CouponPayload {
  code: string
  discount_percentage: number
  max_uses: number
  origin_currency: string
  destination_currency: string
  start_date: string
  end_date: string
  is_active: boolean
}

export interface CouponUpdatePayload extends CouponPayload {
  id: string
}

export interface CuponesRepository {
  getCoupons(): Promise<Coupon[]>
  createCoupon(payload: CouponPayload): Promise<Coupon>
  updateCoupon(payload: CouponUpdatePayload): Promise<Coupon>
  deleteCoupon(id: string): Promise<void>
}
