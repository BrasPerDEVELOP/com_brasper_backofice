import type { TasasRepository } from '../../infrastructure/adapters/TasasRepository'
import type { TaxRate } from '../../domain/models'

export class CreateTaxRateUseCase {
  constructor(private readonly repository: TasasRepository) {}

  async execute(payload: {
    coin_a: string
    coin_b: string
    tax: string
  }): Promise<TaxRate> {
    return this.repository.createTaxRate(payload)
  }
}
