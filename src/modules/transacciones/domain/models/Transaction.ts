/** Transacción tal como la devuelve el API. */
export interface Transaction {
  id?: string
  code?: string
  origin_amount?: number
  destination_amount?: number
  send_date?: string
  payment_date?: string
  status?: string
  send_voucher?: string
  payment_voucher?: string
  /** Aliases compatibles: monto_origen, monto_destino, fecha_envio, fecha_pago, voucher_envio, voucher_pago */
  [key: string]: unknown
}
