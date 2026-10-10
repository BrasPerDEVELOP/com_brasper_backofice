import { formatAccountingMoney } from '@modules/contabilidad/presentation/composables/accounting_money'

/** Fecha y hora de emisión en hora de Lima (SUNAT emite en UTC−5), sin depender del navegador. */
export function formatLimaDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatInvoiceMoney(value: number | null | undefined, currency: string | null | undefined) {
  return formatAccountingMoney(value, currency)
}

/** Clases Tailwind del chip de estado, alineadas con la paleta del backoffice. */
export const INVOICE_TONE_CLASSES: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  muted: 'border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]',
  neutral: 'border-[#dbe7fb] bg-[#f5f8ff] text-brasper-indigoDark'
}
