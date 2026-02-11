import type { ComisionesRepository } from '../../infrastructure/adapters/ComisionesRepository'
import type { Commission } from '../../domain/models'

export class GetCommissionsUseCase {
  constructor(private readonly repository: ComisionesRepository) {}

  async execute(): Promise<Commission[]> {
    return this.repository.getCommissions()
  }
}
