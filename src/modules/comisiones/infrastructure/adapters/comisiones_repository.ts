import type { Commission, CommissionHistoryEntry } from '../../domain/models'

/**
 * Body que espera POST /coin/commission (y /coin/commission-accounting).
 * `max_amount: null` crea un tramo sin límite superior.
 */
export interface CommissionCreateBody {
  coin_a: string
  coin_b: string
  percentage: number
  reverse: string
  min_amount: number
  max_amount: number | null
}

/** Body completo que espera PUT /coin/commission (y /coin/commission-accounting) */
export interface CommissionUpdateBody extends CommissionCreateBody {
  id: string
  created_at?: string
  created_by?: string | null
  updated_at?: string
}

export interface ComisionesRepository {
  getCommissions(): Promise<Commission[]>
  createCommission(payload: CommissionCreateBody): Promise<Commission>
  /** Body completo esperado por PUT /coin/commission */
  updateCommission(id: string, body: CommissionUpdateBody): Promise<Commission>
  deleteCommission(id: string): Promise<void>
  getCommissionHistory(id: string): Promise<CommissionHistoryEntry[]>
}
