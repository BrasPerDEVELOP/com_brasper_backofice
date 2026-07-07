import type { MetricsFilters, WeeklyMetrics } from '../../domain/models'

/** Puerto del repositorio de métricas (consumido por el use case). */
export interface MetricsRepository {
  getWeeklyMetrics(filters: MetricsFilters): Promise<WeeklyMetrics>
}
