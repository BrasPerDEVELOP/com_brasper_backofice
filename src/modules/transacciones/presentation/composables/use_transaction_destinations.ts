import { roundMoneyAmount } from '../../domain/models'

export interface TransactionDestinationDraft {
  bank_account_id: string
  amount: number | null
}

export interface TransactionDestinationsValidation {
  total: number
  difference: number
  error: string | null
}

export function emptyTransactionDestination(): TransactionDestinationDraft {
  return { bank_account_id: '', amount: null }
}

export function validateTransactionDestinations(
  destinations: TransactionDestinationDraft[],
  expectedTotal: number
): TransactionDestinationsValidation {
  const total = roundMoneyAmount(
    destinations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  )
  const difference = roundMoneyAmount(Number(expectedTotal || 0) - total)
  if (destinations.length === 0) {
    return { total, difference, error: 'Agrega al menos una cuenta destino.' }
  }
  if (destinations.some((item) => !item.bank_account_id.trim())) {
    return { total, difference, error: 'Selecciona todas las cuentas destino.' }
  }
  const ids = destinations.map((item) => item.bank_account_id.trim())
  if (new Set(ids).size !== ids.length) {
    return { total, difference, error: 'No se puede repetir una cuenta destino.' }
  }
  if (destinations.some((item) => !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) {
    return { total, difference, error: 'Cada cuenta debe tener un monto mayor que cero.' }
  }
  if (difference !== 0) {
    return {
      total,
      difference,
      error: difference > 0
        ? 'Todavía falta distribuir parte del monto a recibir.'
        : 'Los montos distribuidos superan el monto a recibir.'
    }
  }
  return { total, difference, error: null }
}
