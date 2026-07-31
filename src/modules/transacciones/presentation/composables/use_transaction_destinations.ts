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

export interface DestinationAccountLabelData {
  account_holder_type?: string | null
  holder_names?: string | null
  holder_surnames?: string | null
  business_name?: string | null
  account_number?: string | null
  cci_number?: string | null
  pix_key?: string | null
}

function destinationAccountHolder(account: DestinationAccountLabelData): string {
  const holderType = (account.account_holder_type ?? '')
    .trim()
    .toLocaleLowerCase('es')
  const isBusiness = holderType.includes('juridica') ||
    holderType.includes('jurídica') ||
    holderType.includes('legal')

  if (isBusiness) return account.business_name?.trim() ?? ''

  return [account.holder_names, account.holder_surnames]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}

export function formatDestinationAccountOptionLabel(
  account: DestinationAccountLabelData,
  bankName: string
): string {
  const holder = destinationAccountHolder(account)
  const identifiers: string[] = []
  if (account.account_number?.trim()) identifiers.push(account.account_number.trim())
  if (account.cci_number?.trim()) identifiers.push(`CCI: ${account.cci_number.trim()}`)
  if (account.pix_key?.trim()) identifiers.push(`PIX: ${account.pix_key.trim()}`)

  const accountLabel = [bankName.trim() || '—', identifiers.join(' / ') || '—'].join(' · ')
  return holder ? `${accountLabel} - ${holder}` : accountLabel
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
