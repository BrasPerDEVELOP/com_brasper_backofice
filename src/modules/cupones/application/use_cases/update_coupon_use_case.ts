import type { Coupon } from '../../domain/models'
import type { CouponUpdatePayload, CuponesRepository } from '../../infrastructure/adapters'

export class UpdateCouponUseCase {
  constructor(private readonly repository: CuponesRepository) {}

  async execute(payload: CouponUpdatePayload): Promise<Coupon> {
    return this.repository.updateCoupon(payload)
  }
}
