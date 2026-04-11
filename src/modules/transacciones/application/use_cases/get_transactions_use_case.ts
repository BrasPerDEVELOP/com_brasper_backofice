import type { TransactionsRepository, GetTransactionsParams } from '../../infrastructure/adapters/transactions_repository'
import type { Transaction } from '../../domain/models'
import { normalizeGetTransactionsParams } from '../transaction_payload_guards'

export class GetTransactionsUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(params?: GetTransactionsParams): Promise<Transaction[]> {
    const normalized = normalizeGetTransactionsParams(params)
    return this.repository.getTransactions(normalized)
  }
}
