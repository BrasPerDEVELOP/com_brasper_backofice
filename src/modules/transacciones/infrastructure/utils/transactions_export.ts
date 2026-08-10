import type { Transaction, TransactionTag } from '../../domain/models'
import {
  TRANSACTION_STATUS_LABELS,
  formatTransactionCodeForDisplay,
  normalizeTransactionStatus,
  resolveTransactionStatusForDisplay
} from '../../domain/models'

/** Cabeceras del Excel, en el mismo orden que las columnas de la tabla. */
export const TRANSACTION_EXPORT_HEADERS = [
  'N° del día',
  'Fecha',
  'Hora',
  'Verificada',
  'Código',
  'N° operación',
  'Cliente',
  'Etiquetas',
  'Razón social',
  'Monto de envío',
  'Moneda envío',
  'Cuenta destino',
  'Monto a recibir',
  'Moneda destino',
  'Tipo cambio',
  'Estado',
  'Comp. envío',
  'Comp. pago'
] as const

export interface TransactionExportContext {
  /** `id` → correlativo del envío dentro de su día. */
  dailySequenceById: Record<string, number>
  /** Nombre visible del cliente. */
  clientLabel: (userId: string | undefined) => string
  /** Razón social tal como se muestra en la tabla. */
  companyName: (t: Transaction) => string
  /** Cuentas destino, ya resueltas a texto. */
  destinationAccounts: (t: Transaction) => string
  /** Monedas origen/destino del envío. */
  currencies: (t: Transaction) => { origin: string; destination: string }
  /** Catálogo de etiquetas para traducir ids a nombres. */
  tagById: (id: string) => TransactionTag | undefined
}

function hasAttachment(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasAttachment)
  return typeof value === 'string' && value.trim() !== ''
}

/** Fecha y hora locales separadas, para que Excel pueda ordenar y agrupar. */
function splitDateTime(raw: string | undefined): { date: string; time: string } {
  if (!raw?.trim()) return { date: '', time: '' }
  const ms = Date.parse(raw)
  if (Number.isNaN(ms)) return { date: '', time: '' }
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

function statusLabel(t: Transaction): string {
  const resolved = resolveTransactionStatusForDisplay(t) ?? t.status
  const key = normalizeTransactionStatus(
    resolved
  ) as keyof typeof TRANSACTION_STATUS_LABELS
  return TRANSACTION_STATUS_LABELS[key] ?? (resolved ?? '')
}

/**
 * Arma las filas del Excel de transacciones.
 *
 * Los importes salen como número, no como texto: si se exportaran formateados
 * («S/ 1,200.00») Excel no podría sumarlos, que es lo primero que hace quien
 * abre el archivo. La moneda va en su propia columna.
 */
export function buildTransactionExportRows(
  transactions: Transaction[],
  ctx: TransactionExportContext
): (string | number)[][] {
  return transactions.map((t) => {
    const { date, time } = splitDateTime(t.send_date)
    const currencies = ctx.currencies(t)
    const tags = (Array.isArray(t.tag_ids) ? t.tag_ids : [])
      .map((id) => ctx.tagById(id)?.label)
      .filter((label): label is string => !!label)
      .join(', ')

    return [
      ctx.dailySequenceById[t.id ?? ''] ?? '',
      date,
      time,
      t.checked === true ? 'Sí' : 'No',
      formatTransactionCodeForDisplay(t.code),
      t.operation_number ?? '',
      ctx.clientLabel(t.user_id),
      tags,
      ctx.companyName(t),
      Number(t.origin_amount ?? 0),
      currencies.origin,
      ctx.destinationAccounts(t),
      Number(t.destination_amount ?? 0),
      currencies.destination,
      Number(t.tax_amount ?? 0),
      statusLabel(t),
      hasAttachment(t.send_voucher) ? 'Sí' : 'No',
      hasAttachment(t.payment_voucher) ? 'Sí' : 'No'
    ]
  })
}

/**
 * Nombre del archivo según el alcance visible: un día concreto o el histórico.
 * Deja claro en el propio nombre qué contiene, para que no se confundan dos
 * descargas en la carpeta de Descargas.
 */
export function transactionExportFilename(
  scope: 'day' | 'all',
  day: string,
  today: string
): string {
  return scope === 'day'
    ? `transacciones_${day}.xlsx`
    : `transacciones_todas_${today}.xlsx`
}
