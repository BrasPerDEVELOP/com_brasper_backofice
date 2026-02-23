import type { ExchangeRate, CommissionRange } from '../../domain/models'

/** CurrencyReadDTO desde GET /coin/currencies */
export interface CurrencyReadDTO {
  code: string
  name: string
  symbol: string
}

export interface CalculatorRepository {
  getCurrencies(): Promise<CurrencyReadDTO[]>
  getTaxRates(): Promise<ExchangeRate[]>
  getCommissions(): Promise<CommissionRange[]>
}
