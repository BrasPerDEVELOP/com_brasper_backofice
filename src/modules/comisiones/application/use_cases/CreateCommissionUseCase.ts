import type { ComisionesRepository } from '../../infrastructure/adapters/ComisionesRepository'
import type { Commission } from '../../domain/models'

export class CreateCommissionUseCase {
  constructor(private readonly repository: ComisionesRepository) {}

  async execute(payload: {
    coin_a: string
    coin_b: string
    percentage: string
    reverse: string
    min_amount: string
    max_amount: string
  }): Promise<Commission> {
    return this.repository.createCommission(payload)
  }
}
