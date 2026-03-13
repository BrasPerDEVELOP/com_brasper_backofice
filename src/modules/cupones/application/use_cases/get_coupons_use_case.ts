import type { Coupon } from '../../domain/models'
import type { CuponesRepository } from '../../infrastructure/adapters'

export class GetCouponsUseCase {
  constructor(private readonly repository: CuponesRepository) {}

  async execute(): Promise<Coupon[]> {
    return this.repository.getCoupons()
  }
}
