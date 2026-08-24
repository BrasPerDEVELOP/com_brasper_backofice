export type MissingClientData = 'email' | 'phone' | 'bank_account'

export interface ClientDataSignals {
  has_email?: boolean
  has_phone?: boolean
}

export interface ResolveMissingClientDataOptions {
  bankAccountOwnerIds: ReadonlySet<string>
  canInspectBankAccounts: boolean
  bankAccountsReady: boolean
}

/**
 * Resuelve únicamente faltantes confirmados. Si un dato todavía no cargó, no
 * mostramos una advertencia que podría ser falsa.
 */
export function resolveMissingClientData(
  user: ClientDataSignals | undefined,
  userId: string,
  options: ResolveMissingClientDataOptions
): MissingClientData[] {
  if (!user) return []

  const missing: MissingClientData[] = []
  if (user.has_email === false) missing.push('email')
  if (user.has_phone === false) missing.push('phone')
  if (
    options.canInspectBankAccounts &&
    options.bankAccountsReady &&
    !options.bankAccountOwnerIds.has(userId)
  ) {
    missing.push('bank_account')
  }
  return missing
}
