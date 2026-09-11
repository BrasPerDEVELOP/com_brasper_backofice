/** Símbolos de las monedas de envío que opera Brasper. */
const SYMBOL_BY_CURRENCY: Record<string, string> = {
  pen: 'S/',
  usd: '$',
  brl: 'R$'
}

/** Símbolo de la moneda de envío (`S/`, `R$`, `$`). */
export function accountingCurrencySymbol(currency: string | null | undefined): string {
  const key = (currency ?? '').trim().toLowerCase()
  if (!key) return ''
  return SYMBOL_BY_CURRENCY[key] ?? key.toUpperCase()
}

/**
 * Formatea un importe contable con el símbolo de la moneda de envío.
 * Comisión, IGV y venta final se calculan sobre `origin_amount`, no en soles.
 */
export function formatAccountingMoney(
  value: number | null | undefined,
  currency: string | null | undefined
): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const amount = n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const symbol = accountingCurrencySymbol(currency)
  return symbol ? `${symbol} ${amount}` : amount
}
