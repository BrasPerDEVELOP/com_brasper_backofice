import type { MetricsFilters, MetricsOverview } from '../../domain/models'
import type { MetricsRepository } from '../../infrastructure/adapters/metrics_repository'

export class GetMetricsOverviewUseCase {
  constructor(private readonly repo: MetricsRepository) {}

  execute(filters: MetricsFilters): Promise<MetricsOverview> {
    return this.repo.getMetricsOverview(filters)
  }
}
