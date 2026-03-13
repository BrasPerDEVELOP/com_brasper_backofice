import * as XLSX from 'xlsx'
import type { CreateTransactionPayload } from '../adapters/transactions_repository'

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function num(v: unknown): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function get(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return str(v)
  }
  return ''
}

/** Mapea una fila del Excel al CreateTransactionPayload (mismo formato que POST Crear). */
export function rowToCreatePayload(row: Record<string, unknown>): CreateTransactionPayload | null {
  const bank_account_origin = get(
    row,
    'bank_account_origin',
    'cuenta_origen',
    'cuenta origen',
    'account_origin'
  )
  const bank_account_destination = get(
    row,
    'bank_account_destination',
    'cuenta_destino',
    'cuenta destino',
    'account_destination'
  )
  const user_id = get(row, 'user_id', 'cliente', 'client')
  const tax_rate_id = get(row, 'tax_rate_id', 'tasa', 'tax_rate')
  const commission_id = get(row, 'commission_id', 'comision', 'commission')

  if (!bank_account_origin || !bank_account_destination || !user_id || !tax_rate_id || !commission_id) {
    return null
  }

  const origin_amount = num(
    row['origin_amount'] ?? row['monto_origen'] ?? row['monto origen']
  )
  const destination_amount = num(
    row['destination_amount'] ?? row['monto_destino'] ?? row['monto destino']
  )

  if (!origin_amount && !destination_amount) return null

  const code =
    get(row, 'code', 'codigo') ||
    `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const status = get(row, 'status', 'estado') || 'pending'
  const resultado_comision = num(
    row['resultado_comision'] ?? row['comision_result'] ?? row['comision']
  )
  const total_a_enviar = num(
    row['total_a_enviar'] ?? row['total_to_send'] ?? row['total a enviar']
  )
  const send_date = get(row, 'send_date', 'fecha_envio', 'fecha envio')
  const payment_date = get(row, 'payment_date', 'fecha_pago', 'fecha pago')

  return {
    bank_account_origin,
    bank_account_destination,
    user_id,
    tax_rate_id,
    commission_id,
    status,
    origin_amount: origin_amount || destination_amount,
    destination_amount: destination_amount || origin_amount,
    resultado_comision: resultado_comision || undefined,
    total_a_enviar: total_a_enviar || undefined,
    code,
    send_date: send_date || undefined,
    payment_date: payment_date || undefined
  }
}

/** Parsea un Excel simple y devuelve array de CreateTransactionPayload (mismo POST que Crear). */
export function parseSimpleImportExcel(file: File): Promise<CreateTransactionPayload[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('No se pudo leer el archivo'))
          return
        }
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.SheetNames[0]
        const sheet = firstSheet ? workbook.Sheets[firstSheet] : undefined
        if (!sheet) {
          reject(new Error('El archivo no contiene hojas'))
          return
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
        const payloads = rows
          .map((row) => rowToCreatePayload(row))
          .filter((p): p is CreateTransactionPayload => p != null)
        resolve(payloads)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Error al parsear Excel'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}
