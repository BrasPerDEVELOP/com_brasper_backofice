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

/** IGV peruano (18%). Hoja Brasper: `AH = 18% * AG`. */
export const ACCOUNTING_IGV_RATE = 0.18

/** Divisor para extraer la base neta de un monto con IGV. Hoja: `Q / 118%`. */
export const ACCOUNTING_IGV_GROSS_FACTOR = 1 + ACCOUNTING_IGV_RATE

export interface AccountingInternalSaleBreakdown {
  /** Comisión final interna (neta de IGV). */
  net: number
  /** Impuesto final interno. */
  tax: number
  /** Venta final = net + tax. */
  sale: number
}

function roundAccountingMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Descuento variable de la hoja cuando el API no trae `accounting_percentage`.
 * `=IF(monto<100,0, IF(monto<300,40%, … 75%))`
 */
export function defaultVariableDiscountPercent(
  originAmount: number | null | undefined
): number {
  const amount = originAmount == null ? NaN : Number(originAmount)
  if (!Number.isFinite(amount) || amount < ACCOUNTING_COMMISSION_AMOUNT_THRESHOLD) {
    return 0
  }
  if (amount < 300) return 40
  if (amount < 1000) return 45
  if (amount < 2000) return 50
  if (amount < 3000) return 55
  if (amount < 5000) return 60
  if (amount < 7000) return 65
  if (amount < 10000) return 70
  return 75
}

/**
 * Comisión neta, IGV y venta final de la hoja Brasper:
 *   AG = (Q / 118%) * (1 − V)
 *   AH = 18% * AG
 *   AI = AG + AH
 *
 * `Q` es la comisión del cliente; `V` es el descuento variable en porcentaje
 * (40 = 40%). Si el monto es menor a 100, la hoja fuerza V = 0.
 */
export function calculateAccountingInternalSale(
  clientCommission: number | null | undefined,
  variableDiscountPercent: number | null | undefined
): AccountingInternalSaleBreakdown | undefined {
  const commission = clientCommission == null ? NaN : Number(clientCommission)
  if (!Number.isFinite(commission) || commission === 0) return undefined

  const percent =
    variableDiscountPercent == null ? 0 : Number(variableDiscountPercent)
  if (!Number.isFinite(percent)) return undefined
  const share = percent / 100
  if (share < 0 || share > 1) return undefined

  const net = (commission / ACCOUNTING_IGV_GROSS_FACTOR) * (1 - share)
  const tax = net * ACCOUNTING_IGV_RATE
  return {
    net: roundAccountingMoney(net),
    tax: roundAccountingMoney(tax),
    sale: roundAccountingMoney(net + tax)
  }
}
