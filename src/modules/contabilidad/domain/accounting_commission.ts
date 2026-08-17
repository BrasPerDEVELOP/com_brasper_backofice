/**
 * Descuento variable de una operación: el porcentaje de la comisión de
 * contabilidad (`/coin/commission-accounting`) que le corresponde.
 *
 * A diferencia del descuento especial —que se guarda en la transacción— este
 * porcentaje no viaja en el registro: se resuelve contra el catálogo, igual que
 * lo hace la calculadora, buscando el par de monedas de la operación y luego el
 * tramo cuyo rango cubre el monto de envío.
 *
 * Lógica pura: recibe el catálogo ya cargado y no depende de stores.
 */

/** Tramo del catálogo de comisiones (estructura de `Commission`). */
export interface AccountingCommissionRange {
  id: string
  coin_a: string
  coin_b: string
  percentage: number
  min_amount: number
  max_amount: number
}

export interface AccountingCommissionMatch {
  /** Porcentaje del tramo, tal cual lo define el catálogo (ej. `3.5` = 3.5%). */
  percentage: number
  coinA: string
  coinB: string
  minAmount: number
  maxAmount: number
  /**
   * `false` cuando ningún tramo del par cubre el monto de envío y se recurrió al
   * último como aproximación. La vista lo advierte en el tooltip.
   */
  withinBracket: boolean
}

function normalizeCoin(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Tramo aplicable al monto de envío. Si ninguno lo cubre se devuelve el último
 * del par (mismo criterio que `pickCommissionBracketForAmount` en transacciones),
 * marcado como fuera de rango.
 */
function pickBracket(
  originAmount: number,
  pairCommissions: AccountingCommissionRange[]
): { row: AccountingCommissionRange; withinBracket: boolean } | null {
  if (pairCommissions.length === 0) return null
  const match = pairCommissions.find(
    (c) => originAmount >= c.min_amount && originAmount <= c.max_amount
  )
  if (match) return { row: match, withinBracket: true }
  const last = pairCommissions[pairCommissions.length - 1]
  return last ? { row: last, withinBracket: false } : null
}

/**
 * Comisión de contabilidad que aplica a una operación, o `null` si falta el par
 * de monedas, el monto de envío, o el catálogo no tiene tramos para ese par.
 */
export function resolveAccountingCommission(params: {
  originCurrency: string | null | undefined
  destinationCurrency: string | null | undefined
  originAmount: unknown
  commissions: AccountingCommissionRange[]
}): AccountingCommissionMatch | null {
  const coinA = normalizeCoin(params.originCurrency)
  const coinB = normalizeCoin(params.destinationCurrency)
  if (!coinA || !coinB) return null

  const originAmount = toFiniteNumber(params.originAmount)
  if (originAmount == null || originAmount <= 0) return null

  const pairCommissions = params.commissions.filter(
    (c) => normalizeCoin(c.coin_a) === coinA && normalizeCoin(c.coin_b) === coinB
  )
  const bracket = pickBracket(originAmount, pairCommissions)
  if (!bracket) return null

  const percentage = toFiniteNumber(bracket.row.percentage)
  if (percentage == null) return null

  return {
    percentage,
    coinA,
    coinB,
    minAmount: bracket.row.min_amount,
    maxAmount: bracket.row.max_amount,
    withinBracket: bracket.withinBracket
  }
}
