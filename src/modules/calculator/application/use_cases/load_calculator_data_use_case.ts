import type { CalculatorRepository } from '../../infrastructure/adapters/calculator_repository'
import type { ExchangeRate, CommissionRange } from '../../domain/models'

export interface LoadedCalculatorData {
  currencies: Awaited<ReturnType<CalculatorRepository['getCurrencies']>>
  taxRates: ExchangeRate[]
  commissions: CommissionRange[]
}

export class LoadCalculatorDataUseCase {
  constructor(private readonly repository: CalculatorRepository) {}

  async execute(): Promise<LoadedCalculatorData> {
    const [currencies, taxRates, commissions] = await Promise.all([
      this.repository.getCurrencies(),
      this.repository.getTaxRates(),
      this.repository.getCommissions()
    ])
    return { currencies, taxRates, commissions }
  }
}
