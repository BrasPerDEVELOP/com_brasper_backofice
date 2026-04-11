/** Transacción (API GET/POST) — alineado con TransactionReadDTO / flujo checklist. */
export interface Transaction {
  id?: string
  bank_account_id?: string
  bank_account_origin_id?: string
  bank_account_destination_id?: string
  user_id?: string
  tax_rate_id?: string
  commission_id?: string
  status?: string
  origin_amount?: number
  destination_amount?: number
  code?: string
  /** API inglés / alias en respuesta */
  commission_result?: number
  total_to_send?: number
  /** Alias frecuente en payloads y formularios */
  resultado_comision?: number
  total_a_enviar?: number
  send_date?: string
  payment_date?: string
  send_voucher?: string
  payment_voucher?: string
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
