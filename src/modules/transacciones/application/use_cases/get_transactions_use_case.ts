import type { TransactionsRepository, GetTransactionsParams } from '../../infrastructure/adapters/transactions_repository'
import type { Transaction } from '../../domain/models'

export class GetTransactionsUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(params?: GetTransactionsParams): Promise<Transaction[]> {
    return this.repository.getTransactions(params)
  }
}
