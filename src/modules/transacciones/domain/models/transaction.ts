/**
 * Transacción (API) — alineado con el modelo ORM / respuesta PUT+GET.
 * IDs planos + `user` anidado opcional en JSON; alias legacy en import/cálculos.
 */
export interface Transaction {
  id?: string
  bank_account_id?: string
  bank_account_origin_id?: string
  bank_account_destination_id?: string
  user_id?: string
  agent_id?: string
  tax_rate_id?: string
  commission_id?: string
  status?: string
  origin_amount?: number
  destination_amount?: number
  code?: string
  operation_number?: string | null
  /** API (inglés) */
  commission_result?: number
  total_to_send?: number
  tax_amount?: number
  /** Alias en payloads y formularios */
  resultado_comision?: number
  total_a_enviar?: number
  coupon_id?: string | null
  coupon_discount_code?: string | null
  coupon_origin_amount?: number | null
  coupon_destination_amount?: number | null
  coupon_discount_percentage?: number | null
  coupon_discount_commission?: number | null
  coupon_discount_total_to_send?: number | null
  send_date?: string
  payment_date?: string
  send_voucher?: string
  payment_voucher?: string
  /** Imagen checklist (path/URL), nullable en API */
  checked_image?: string | null
  checked?: boolean
  created_at?: string
  created_by?: string
  updated_at?: string
  /** Contabilidad / respuesta API extendida */
  comision_final_interna?: number
  impuesto_final_interno?: number
  venta_final?: number
  fecha_emision?: string
  observaciones?: string
  dias_atraso?: number
  /** Aliases compatibles con import Excel */
  [key: string]: unknown
}

/**
 * Valores de `status` según API (incl. legado).
 * Nuevas altas: `verification` por defecto; el servidor recalcula con PUT.
 */
export const TRANSACTION_STATUSES = [
  'verification',
  'verified',
  'completed',
  'failed',
  'pending',
  'checked',
  'cancelled'
] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  verification: 'En verificación',
  verified: 'Verificado',
  completed: 'Finalizada',
  failed: 'Fallida',
  pending: 'Pendiente (legado)',
  checked: 'Verificada (legado)',
  cancelled: 'Cancelado'
}
