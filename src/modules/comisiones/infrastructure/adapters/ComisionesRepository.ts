import type { Commission, CommissionHistoryEntry } from '../../domain/models'

/** Body completo que espera PUT /coin/commission */
export interface CommissionUpdateBody {
  id: string
  coin_a: string
  coin_b: string
  percentage: number
  reverse: string
  min_amount: number
  max_amount: number
  created_at?: string
  created_by?: string | null
  updated_at?: string
}

export interface ComisionesRepository {
  getCommissions(): Promise<Commission[]>
  createCommission(payload: {
    coin_a: string
    coin_b: string
    percentage: string
    reverse: string
    min_amount: string
    max_amount: string
  }): Promise<Commission>
  /** Body completo esperado por PUT /coin/commission */
  updateCommission(id: string, body: CommissionUpdateBody): Promise<Commission>
  deleteCommission(id: string): Promise<void>
  getCommissionHistory(id: string): Promise<CommissionHistoryEntry[]>
}
