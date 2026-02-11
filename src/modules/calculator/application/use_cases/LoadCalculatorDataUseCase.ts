import type { CalculatorRepository } from '../../infrastructure/adapters/CalculatorRepository'
import type { ExchangeRate, CommissionRange, Coupon } from '../../domain/models'

export interface LoadedCalculatorData {
  currencies: Awaited<ReturnType<CalculatorRepository['getCurrencies']>>
  taxRates: ExchangeRate[]
  commissions: CommissionRange[]
  coupons: Coupon[]
}

export class LoadCalculatorDataUseCase {
  constructor(private readonly repository: CalculatorRepository) {}

  async execute(): Promise<LoadedCalculatorData> {
    const [currencies, taxRates, commissions, coupons] = await Promise.all([
      this.repository.getCurrencies(),
      this.repository.getTaxRates(),
      this.repository.getCommissions(),
      this.repository.getAutomaticCoupons()
    ])
    return { currencies, taxRates, commissions, coupons }
  }
}
