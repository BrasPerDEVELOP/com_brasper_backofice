/** Transacción (API GET/POST). */
export interface Transaction {
  id?: string
  bank_account_id?: string
  user_id?: string
  tax_rate_id?: string
  commission_id?: string
  status?: string
  origin_amount?: number
  destination_amount?: number
  code?: string
  send_date?: string
  payment_date?: string
  send_voucher?: string
  payment_voucher?: string
  created_at?: string
  created_by?: string
  updated_at?: string
  /** Aliases compatibles con import Excel */
  [key: string]: unknown
}

export const TRANSACTION_STATUSES = ['pending', 'completed', 'failed', 'cancelled'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completado',
  failed: 'Fallido',
  cancelled: 'Cancelado'
}
