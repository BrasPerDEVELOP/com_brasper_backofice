import type { TransactionsRepository } from '../../infrastructure/adapters/transactions_repository'
import { assertValidTransactionId } from '../transaction_payload_guards'

export class DeleteTransactionUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(id: string): Promise<void> {
    assertValidTransactionId(id)
    return this.repository.deleteTransaction(id.trim())
  }
}
