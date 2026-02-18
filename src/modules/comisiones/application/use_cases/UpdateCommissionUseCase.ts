import type { ComisionesRepository, CommissionUpdateBody } from '../../infrastructure/adapters/ComisionesRepository'
import type { Commission } from '../../domain/models'

export class UpdateCommissionUseCase {
  constructor(private readonly repository: ComisionesRepository) {}

  async execute(id: string, body: CommissionUpdateBody): Promise<Commission> {
    return this.repository.updateCommission(id, body)
  }
}
