import type { WeeklyMetrics, WeeklyMetricsFilters } from '../../domain/models'
import type { MetricsRepository } from '../../infrastructure/adapters/metrics_repository'

/** Obtiene las métricas semanales del corredor indicado. */
export class GetWeeklyMetricsUseCase {
  constructor(private readonly repo: MetricsRepository) {}

  execute(filters: WeeklyMetricsFilters): Promise<WeeklyMetrics> {
    return this.repo.getWeeklyMetrics(filters)
  }
}
