import type {
  TransactionsRepository,
  GetTransactionsParams,
  PagedTransactions,
} from '../../infrastructure/adapters/transactions_repository'
import { normalizeGetTransactionsParams } from '../transaction_payload_guards'

export class GetTransactionsUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(params?: GetTransactionsParams): Promise<PagedTransactions> {
    const normalized = normalizeGetTransactionsParams(params)
    return this.repository.getTransactions(normalized)
  }
}
