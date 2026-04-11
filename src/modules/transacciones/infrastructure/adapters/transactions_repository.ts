import type { Transaction } from '../../domain/models'

export interface CreateTransactionPayload {
  bank_account_origin: string
  bank_account_destination: string
  user_id: string
  tax_rate_id: string
  commission_id: string
  status?: string
  origin_amount: number
  destination_amount: number
  resultado_comision?: number | null
  total_a_enviar?: number | null
  code: string
  send_date?: string
  payment_date?: string
  send_voucher?: string | File | null
  payment_voucher?: string | File | null
  /** UUID o null. No enviar "automatic" - el API espera UUID válido. */
  coupon_id?: string | null
  /** En POST el servidor ignora y deja `false`; usar solo en PUT. */
  checked?: boolean
}

export interface UpdateTransactionPayload extends Partial<CreateTransactionPayload> {
  /** PUT: el servidor recalcula `status` salvo `failed`. */
  checked?: boolean
}

export interface GetTransactionsParams {
  status?: string | null
  user_id?: string | null
  /** @deprecated Filtro combinado; la API documenta origen/destino por separado. */
  bank_account_id?: string | null
  bank_account_origin_id?: string | null
  bank_account_destination_id?: string | null
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
