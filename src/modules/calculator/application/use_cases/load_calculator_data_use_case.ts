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
    /** Tasas y comisiones son las que bloquean la calculadora; `/currencies` no se consume en la UI actual. */
    const [taxRates, commissions] = await Promise.all([
      this.repository.getTaxRates(),
      this.repository.getCommissions()
    ])
    return { currencies: [], taxRates, commissions }
  }
}
