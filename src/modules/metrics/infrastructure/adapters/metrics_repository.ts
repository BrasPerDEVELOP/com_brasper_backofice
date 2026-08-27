import type {
  MetricsFilters,
  MetricsOverview,
  WeeklyMetrics,
  WeeklyMetricsFilters,
} from '../../domain/models'

/** Puerto del repositorio de métricas (consumido por el use case). */
export interface MetricsRepository {
  getMetricsOverview(filters: MetricsFilters): Promise<MetricsOverview>
  getWeeklyMetrics(filters: WeeklyMetricsFilters): Promise<WeeklyMetrics>
}
