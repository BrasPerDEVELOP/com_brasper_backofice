import type { Transaction } from '../../domain/models'

export interface TransactionsRepository {
  getTransactions(): Promise<Transaction[]>
  importFromExcel(file: File): Promise<unknown>
}
