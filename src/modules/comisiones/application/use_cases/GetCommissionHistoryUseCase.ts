import type { ComisionesRepository } from '../../infrastructure/adapters/ComisionesRepository'
import type { CommissionHistoryEntry } from '../../domain/models'

export class GetCommissionHistoryUseCase {
  constructor(private readonly repository: ComisionesRepository) {}

  async execute(id: string): Promise<CommissionHistoryEntry[]> {
    return this.repository.getCommissionHistory(id)
  }
}
