import type { Transaction } from '../../domain/models'
import { transactionFromApiRecord } from './parse_transaction'
import { extractTransactionsListFromApiPayload } from '../utils/transactions_api_list'

export function parseTransactions(data: unknown): Transaction[] {
  return extractTransactionsListFromApiPayload(data).map((row) =>
    transactionFromApiRecord(row as Record<string, unknown>),
  )
}
