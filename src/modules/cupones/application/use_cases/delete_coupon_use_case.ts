import type { CuponesRepository } from '../../infrastructure/adapters'

export class DeleteCouponUseCase {
  constructor(private readonly repository: CuponesRepository) {}

  async execute(id: string): Promise<void> {
    return this.repository.deleteCoupon(id)
  }
}
