import type { Commission } from '../../domain/models'

export interface ComisionesRepository {
  getCommissions(): Promise<Commission[]>
}
