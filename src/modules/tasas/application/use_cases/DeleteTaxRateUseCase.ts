import type { TasasRepository } from '../../infrastructure/adapters/TasasRepository'

export class DeleteTaxRateUseCase {
  constructor(private readonly repository: TasasRepository) {}

  async execute(id: string): Promise<void> {
    return this.repository.deleteTaxRate(id)
  }
}
