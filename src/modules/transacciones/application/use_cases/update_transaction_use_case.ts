import type { TransactionsRepository, UpdateTransactionPayload } from '../../infrastructure/adapters/transactions_repository'
import type { Transaction } from '../../domain/models'
import { assertValidTransactionId } from '../transaction_payload_guards'

export class UpdateTransactionUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(id: string, payload: UpdateTransactionPayload): Promise<Transaction> {
    assertValidTransactionId(id)
    return this.repository.updateTransaction(id.trim(), payload)
  }
}
