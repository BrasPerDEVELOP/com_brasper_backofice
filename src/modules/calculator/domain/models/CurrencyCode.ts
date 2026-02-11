/** Códigos de moneda (lowercase, igual que API: pen, usd, brl). */
export type CurrencyCode = 'pen' | 'usd' | 'brl'

export const CURRENCY_CODES: CurrencyCode[] = ['pen', 'usd', 'brl']

/** Etiquetas para UI (alineado con backend /coin/currencies). */
export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  pen: 'Sol Peruano',
  usd: 'Dólar',
  brl: 'Real Brasileño'
}

/** Pares permitidos: desde cada moneda, a cuáles se puede enviar. */
export const CURRENCY_OPTIONS: Record<CurrencyCode, CurrencyCode[]> = {
  pen: ['brl', 'usd'],
  usd: ['brl'],
  brl: ['pen', 'usd']
}

export function getCurrencyPairKey(from: CurrencyCode, to: CurrencyCode): string {
  return `${from}-${to}`
}
