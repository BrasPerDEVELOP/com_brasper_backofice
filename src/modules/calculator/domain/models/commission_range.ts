import type { CurrencyCode } from './currency_code'

/**
 * CommissionReadDTO: para calcular comisión y enviar commission_id en POST /transactions/.
 * `max_amount` en `null` es el tramo "a más", sin límite superior.
 */
export interface CommissionRange {
  id: string
  coin_a: CurrencyCode
  coin_b: CurrencyCode
  percentage: number
  reverse: boolean
  min_amount: number
  max_amount: number | null
}
