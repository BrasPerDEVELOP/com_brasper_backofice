import type { TransactionsRepository, UpdateTransactionPayload } from '../../infrastructure/adapters/transactions_repository'
import type { Transaction } from '../../domain/models'

export class UpdateTransactionUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(id: string, payload: UpdateTransactionPayload): Promise<Transaction> {
    return this.repository.updateTransaction(id, payload)
  }
}
