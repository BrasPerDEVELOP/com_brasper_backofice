import type { ManagementDashboard, ManagementFilters } from '../../domain/models'
import type { GerenciaRepository } from '../../infrastructure/adapters/gerencia_repository'

export class GetManagementDashboardUseCase {
  constructor(private readonly repo: GerenciaRepository) {}

  execute(filters: ManagementFilters): Promise<ManagementDashboard> {
    return this.repo.getDashboard(filters)
  }
}
