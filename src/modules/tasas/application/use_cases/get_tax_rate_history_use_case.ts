import type { TasasRepository } from '../../infrastructure/adapters/tasas_repository'
import type { TaxRateHistoryEntry } from '../../domain/models'

export class GetTaxRateHistoryUseCase {
  constructor(private readonly repository: TasasRepository) {}

  async execute(id: string): Promise<TaxRateHistoryEntry[]> {
    return this.repository.getTaxRateHistory(id)
  }
}
