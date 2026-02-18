import type { TaxRate, TaxRateHistoryEntry } from '../../domain/models'

export interface TasasRepository {
  getTaxRates(): Promise<TaxRate[]>
  updateTaxRate(id: string, payload: { coin_a: string; coin_b: string; tax: string }): Promise<TaxRate>
  createTaxRate(payload: { coin_a: string; coin_b: string; tax: string }): Promise<TaxRate>
  deleteTaxRate(id: string): Promise<void>
  getTaxRateHistory(id: string): Promise<TaxRateHistoryEntry[]>
}
