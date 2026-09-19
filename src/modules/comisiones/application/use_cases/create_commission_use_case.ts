import type {
  ComisionesRepository,
  CommissionCreateBody
} from '../../infrastructure/adapters/comisiones_repository'
import type { Commission } from '../../domain/models'

export class CreateCommissionUseCase {
  constructor(private readonly repository: ComisionesRepository) {}

  async execute(payload: CommissionCreateBody): Promise<Commission> {
    return this.repository.createCommission(payload)
  }
}
