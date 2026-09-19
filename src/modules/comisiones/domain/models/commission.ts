/**
 * Recurso del API que respalda una comisión. Ambos exponen la misma estructura
 * y los mismos permisos (`commissions.*`); solo cambia a quién aplica la regla.
 * - `commission`: comisiones de venta (`/coin/commission`).
 * - `commission-accounting`: comisiones de contabilidad (`/coin/commission-accounting`).
 */
export type CommissionResource = 'commission' | 'commission-accounting'

/**
 * Comisión: regla de comisión por par de monedas y rango de montos.
 * `max_amount` en `null` significa "sin límite superior" (tramo "a más"),
 * igual que en el API, donde la columna es nullable.
 */
export interface Commission {
  id: string
  coin_a: string
  coin_b: string
  percentage: number
  reverse: string
  min_amount: number
  max_amount: number | null
  created_at?: string
  created_by?: string | null
  updated_at?: string
}
