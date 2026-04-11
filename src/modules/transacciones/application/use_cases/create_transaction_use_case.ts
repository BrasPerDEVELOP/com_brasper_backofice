import type { TransactionsRepository, CreateTransactionPayload } from '../../infrastructure/adapters/transactions_repository'
import type { Transaction } from '../../domain/models'
import { assertCreateTransactionPayload } from '../transaction_payload_guards'

export class CreateTransactionUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(payload: CreateTransactionPayload): Promise<Transaction> {
    assertCreateTransactionPayload(payload)
    return this.repository.createTransaction(payload)
  }
}
