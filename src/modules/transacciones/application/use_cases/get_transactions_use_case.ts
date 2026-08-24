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

/**
 * Listado contable: mismos filtros que `GetTransactionsUseCase`, pero cada
 * transacción llega con el descuento variable (`accounting_percentage`) y los
 * importes contables que resuelve el servidor.
 */
export class GetAccountingTransactionsUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(params?: GetTransactionsParams): Promise<PagedTransactions> {
    const normalized = normalizeGetTransactionsParams(params)
    return this.repository.getAccountingTransactions(normalized)
  }
}
