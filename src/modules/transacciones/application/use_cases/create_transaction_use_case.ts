import type { TransactionsRepository, CreateTransactionPayload } from '../../infrastructure/adapters/transactions_repository'
import type { Transaction } from '../../domain/models'

export class CreateTransactionUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(payload: CreateTransactionPayload): Promise<Transaction> {
    return this.repository.createTransaction(payload)
  }
}
