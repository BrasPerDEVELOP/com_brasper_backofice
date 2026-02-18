import type { ComisionesRepository } from '../../infrastructure/adapters/ComisionesRepository'

export class DeleteCommissionUseCase {
  constructor(private readonly repository: ComisionesRepository) {}

  async execute(id: string): Promise<void> {
    return this.repository.deleteCommission(id)
  }
}
