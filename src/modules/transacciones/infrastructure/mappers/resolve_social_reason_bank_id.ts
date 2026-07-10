export interface SocialReasonBankCandidate {
  id: string
  company?: string | null
  currency?: string | null
}

export interface ResolveSocialReasonBankIdInput {
  /** ID persistido en la transacción; no depende de que el catálogo ya haya cargado. */
  persistedBankId?: string | null
  companyName?: string | null
  originCurrency?: string | null
  banks: readonly SocialReasonBankCandidate[]
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

/**
 * Resuelve el banco usado como razón social sin adivinar entre bancos ambiguos.
 *
 * Las transacciones nuevas guardan el ID exacto. Para registros legacy sin ID solo
 * se permite reconstruirlo cuando empresa + moneda producen una única coincidencia.
 */
export function resolveSocialReasonBankId({
  persistedBankId,
  companyName,
  originCurrency,
  banks
}: ResolveSocialReasonBankIdInput): string {
  const exactId = (persistedBankId ?? '').trim()
  if (exactId) return exactId

  const company = normalize(companyName)
  const currency = normalizeCurrency(originCurrency)
  if (!company || !currency) return ''

  const candidateIds = new Set<string>()
  for (const bank of banks) {
    if (normalize(bank.company) !== company) continue
    if (normalizeCurrency(bank.currency) !== currency) continue
    const id = String(bank.id ?? '').trim()
    if (id) candidateIds.add(id)
  }

  return candidateIds.size === 1 ? Array.from(candidateIds)[0] ?? '' : ''
}
