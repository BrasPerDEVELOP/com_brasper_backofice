import type { TasasRepository } from '../../infrastructure/adapters/TasasRepository'
import type { TaxRate } from '../../domain/models'

export class UpdateTaxRateUseCase {
  constructor(private readonly repository: TasasRepository) {}

  async execute(
    id: string,
    payload: { coin_a: string; coin_b: string; tax: string }
  ): Promise<TaxRate> {
    return this.repository.updateTaxRate(id, payload)
  }
}
