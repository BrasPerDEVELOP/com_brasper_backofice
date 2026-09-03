import type { Transaction } from '../../domain/models'

export interface TransactionDestinationPayload {
  bank_account_id: string
  amount: number
}

export type TransactionAttachmentValue = string | File
export type TransactionAttachmentPayload =
  | TransactionAttachmentValue
  | TransactionAttachmentValue[]
  | null

export interface CreateTransactionPayload {
  /** Opcional: el flujo permite crear sin cuenta de origen asignada. */
  bank_account_origin?: string
  bank_account_destination: string
  destinations?: TransactionDestinationPayload[]
  user_id: string
  agent_id?: string
  tax_rate_id: string
  commission_id: string
  status?: string
  origin_amount: number
  destination_amount: number
  resultado_comision?: number | null
  total_a_enviar?: number | null
  /** Tipo de cambio del step 1 (`CalculatorResult.rate`). */
  tax_amount?: number | null
  code: string
  operation_number?: string | null
  send_date?: string
  payment_date?: string
  billing_date?: string | null
  send_voucher?: TransactionAttachmentPayload
  payment_voucher?: TransactionAttachmentPayload
  checked_image?: TransactionAttachmentPayload
  /** UUID o null. No enviar "automatic" - el API espera UUID válido. */
  coupon_id?: string | null
  coupon_discount_code?: string | null
  coupon_origin_amount?: number | null
  coupon_destination_amount?: number | null
  coupon_discount_percentage?: number | null
  coupon_discount_commission?: number | null
  coupon_discount_total_to_send?: number | null
  /** Relación con catálogo de bancos (cuenta destino). */
  bank_id?: string
  bank_name?: string
  company_name?: string
  /** Banco exacto del catálogo elegido como razón social. */
  social_reason_bank_id?: string | null
  /** En POST el servidor ignora y deja `false`; usar solo en PUT. */
  checked?: boolean
  /**
   * Lista autoritativa de etiquetas: reemplaza las actuales (a diferencia de los
   * comprobantes, que se acumulan). Omitir el campo las deja como estaban.
   */
  tag_ids?: string[]
}

export interface UpdateTransactionPayload extends Partial<CreateTransactionPayload> {
  /** PUT: el servidor recalcula `status` salvo `failed`. */
  checked?: boolean
  /**
   * Borrado individual de comprobantes ya subidos: lista autoritativa de los
   * archivos EXISTENTES que deben conservarse (keys o URLs del GET). Los
   * archivos nuevos del mismo request se agregan después en el servidor.
   */
  send_vouchers_keep?: string[]
  payment_vouchers_keep?: string[]
  checked_images_keep?: string[]
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
  /** Rango por `send_date` (fecha de envío), distinto de `created_at`. */
  send_date_from?: string | null
  send_date_to?: string | null
  /** Búsqueda de texto libre (código, nº de operación o id). */
  search?: string | null
  /** Filtro por moneda (origen o destino de la tasa). */
  currency?: string | null
  /** Moneda origen de la tasa (coin_a). */
  origin_currency?: string | null
  /** Moneda destino de la tasa (coin_b). */
  destination_currency?: string | null
  /** Paginación de servidor. */
  skip?: number | null
  limit?: number | null
}

/** Página de transacciones devuelta por el API (paginación offset/limit). */
export interface PagedTransactions {
  items: Transaction[]
  total: number
}

/** Métricas agregadas para el dashboard (sobre todas las transacciones). */
export interface TransactionMetrics {
  total: number
  by_status: Record<string, number>
  volume_origin: number
  volume_destination: number
  last_7_days: number
}

export interface TransactionsRepository {
  getTransactions(params?: GetTransactionsParams): Promise<PagedTransactions>
  /** Mismo listado con los campos contables; requiere permiso `accounting.view`. */
  getAccountingTransactions(params?: GetTransactionsParams): Promise<PagedTransactions>
  getTransactionMetrics(): Promise<TransactionMetrics>
  getTransactionById(id: string): Promise<Transaction | null>
  createTransaction(payload: CreateTransactionPayload): Promise<Transaction>
  updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Transaction>
  updateAccountingBillingDate(id: string, billingDate: string): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>
  importFromExcel(file: File): Promise<unknown>
}
