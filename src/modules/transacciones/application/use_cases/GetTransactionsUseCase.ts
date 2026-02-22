import type { TransactionsRepository } from '../../infrastructure/adapters/TransactionsRepository'
import type { Transaction } from '../../domain/models'

export class GetTransactionsUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(): Promise<Transaction[]> {
    return this.repository.getTransactions()
  }
}
