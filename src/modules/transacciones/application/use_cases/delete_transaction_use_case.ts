import type { TransactionsRepository } from '../../infrastructure/adapters/transactions_repository'

export class DeleteTransactionUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(id: string): Promise<void> {
    return this.repository.deleteTransaction(id)
  }
}
