/** Comisión: regla de comisión por par de monedas y rango de montos (API /coin/commission). */
export interface Commission {
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
