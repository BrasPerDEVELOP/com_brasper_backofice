/**
 * Comisión de contabilidad según la regla operativa (hoja Brasper):
 *   =IF(monto=0, "", IF(monto<100, 3, monto * porcentaje))
 *
 * El porcentaje llega como número entero/decimal del API (`accounting_percentage`
 * o catálogo `/coin/commission-accounting`, p. ej. `3` = 3%).
 */

/** Umbral del monto de envío bajo el cual aplica la comisión mínima fija. */
export const ACCOUNTING_COMMISSION_AMOUNT_THRESHOLD = 100

/** Comisión fija cuando el monto de envío es positivo pero menor al umbral. */
export const ACCOUNTING_COMMISSION_DEFAULT = 3

/**
 * Calcula la comisión contable a mostrar.
 * Devuelve `undefined` cuando no hay monto (o es 0) o, por encima del umbral,
 * cuando falta el porcentaje de contabilidad.
 */
export function calculateAccountingCommission(
  originAmount: number | null | undefined,
  accountingPercentage: number | null | undefined
): number | undefined {
  const amount = originAmount == null ? NaN : Number(originAmount)
  if (!Number.isFinite(amount) || amount === 0) return undefined

  if (amount < ACCOUNTING_COMMISSION_AMOUNT_THRESHOLD) {
    return ACCOUNTING_COMMISSION_DEFAULT
  }

  if (accountingPercentage == null) return undefined
  const percentage = Number(accountingPercentage)
  if (!Number.isFinite(percentage)) return undefined

  return Math.round(amount * (percentage / 100) * 100) / 100
}

/** Total a enviar: monto de envío menos la comisión contable. */
export function calculateAccountingFinalSale(
  originAmount: number | null | undefined,
  commission: number | null | undefined
): number | undefined {
  const amount = originAmount == null ? NaN : Number(originAmount)
  const c = commission == null ? NaN : Number(commission)
  if (!Number.isFinite(amount) || !Number.isFinite(c)) return undefined
  return Math.round((amount - c) * 100) / 100
}
