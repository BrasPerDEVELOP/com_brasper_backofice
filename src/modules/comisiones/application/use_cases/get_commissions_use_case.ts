import type { ComisionesRepository } from '../../infrastructure/adapters/comisiones_repository'
import type { Commission } from '../../domain/models'

export class GetCommissionsUseCase {
  constructor(private readonly repository: ComisionesRepository) {}

  async execute(): Promise<Commission[]> {
    return this.repository.getCommissions()
  }
}
