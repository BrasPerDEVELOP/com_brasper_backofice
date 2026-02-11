import type { TasasRepository } from '../../infrastructure/adapters/TasasRepository'
import type { TaxRate } from '../../domain/models'

export class GetTaxRatesUseCase {
  constructor(private readonly repository: TasasRepository) {}

  async execute(): Promise<TaxRate[]> {
    return this.repository.getTaxRates()
  }
}
