/** Tasa de cambio: par de monedas y valor (API /coin/tax-rate). */
export interface TaxRate {
  id: string
  coin_a: string
  coin_b: string
  tax: number
  created_at?: string
  updated_at?: string
}
