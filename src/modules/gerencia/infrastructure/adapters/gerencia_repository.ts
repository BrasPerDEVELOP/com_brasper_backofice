import type { ManagementDashboard, ManagementFilters } from '../../domain/models'

/** Puerto del repositorio del panel gerencial. */
export interface GerenciaRepository {
  getDashboard(filters: ManagementFilters): Promise<ManagementDashboard>
}
