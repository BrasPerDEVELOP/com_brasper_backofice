/**
 * Fase C1 — Labels y badges de estado de transacción.
 *
 * Funciones puras (sin store) movidas desde `transacciones_view.vue` para
 * poder testearlas y reutilizarlas. Comportamiento idéntico al previo.
 */
import { normalizeTransactionStatus } from '../../domain/transaction_domain'
import { TRANSACTION_STATUS_LABELS } from '../../domain/models'

/** Etiqueta legible del estado usando el catálogo del dominio; `-` si no hay estado. */
export function getTransactionStatusLabel(status: string | undefined): string {
  if (!status) return '-'
  const s = normalizeTransactionStatus(status)
  return TRANSACTION_STATUS_LABELS[s as keyof typeof TRANSACTION_STATUS_LABELS] ?? status
}

/** Clases Tailwind del badge de estado (mismos colores que la tabla actual). */
export function getTransactionStatusRowBadgeClass(status: string | undefined): string {
  const s = normalizeTransactionStatus(status ?? '')
  switch (s) {
    case 'verification':
    case 'pending':
      return 'bg-amber-100 text-amber-900'
    case 'verified':
      return 'bg-violet-100 text-violet-900'
    case 'completed':
      return 'bg-emerald-100 text-emerald-900'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'checked':
      return 'bg-sky-100 text-sky-900'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-[#dbeafe] text-brasper-indigoDark'
  }
}

/** Composable delgado que expone los helpers de estado para las vistas. */
export function useTransactionStatusLabels() {
  return {
    getStatusLabel: getTransactionStatusLabel,
    statusRowBadgeClass: getTransactionStatusRowBadgeClass
  }
}
