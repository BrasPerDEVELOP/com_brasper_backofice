import type { Coupon } from '../../domain/models'
import type { CouponPayload, CuponesRepository } from '../../infrastructure/adapters'

export class CreateCouponUseCase {
  constructor(private readonly repository: CuponesRepository) {}

  async execute(payload: CouponPayload): Promise<Coupon> {
    return this.repository.createCoupon(payload)
  }
}
