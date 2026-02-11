import type { CurrencyCode } from './CurrencyCode'

/** TaxRateReadDTO: id, coin_a, coin_b, tax (para POST /transactions/ usamos id). */
export interface ExchangeRate {
  id: string
  pair: string
  rate: number
  from: CurrencyCode
  to: CurrencyCode
}
