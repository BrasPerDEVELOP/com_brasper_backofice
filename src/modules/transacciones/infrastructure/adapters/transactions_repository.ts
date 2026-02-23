import type { Transaction } from '../../domain/models'

export interface CreateTransactionPayload {
  bank_account_id: string
  user_id: string
  tax_rate_id?: string
  commission_id?: string
  status?: string
  origin_amount: number
  destination_amount: number
  code?: string
  send_date?: string
  payment_date?: string
  send_voucher?: string
  payment_voucher?: string
}

export interface UpdateTransactionPayload extends Partial<CreateTransactionPayload> {}

export interface GetTransactionsParams {
  status?: string | null
  user_id?: string | null
  bank_account_id?: string | null
  created_at_from?: string | null
  created_at_to?: string | null
}

export interface TransactionsRepository {
  getTransactions(params?: GetTransactionsParams): Promise<Transaction[]>
  getTransactionById(id: string): Promise<Transaction | null>
  createTransaction(payload: CreateTransactionPayload): Promise<Transaction>
  updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>
  importFromExcel(file: File): Promise<unknown>
}
