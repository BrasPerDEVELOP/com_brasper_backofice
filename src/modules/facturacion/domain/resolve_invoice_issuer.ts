import type { BillingIssuerInfo } from './models'

function normalizeCompanyName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-PE')
}

/** Solo relaciona nombres legales exactos; los nombres comerciales pueden ser compartidos. */
export function issuerForTransactionCompany(
  companyName: string | null | undefined,
  issuers: readonly BillingIssuerInfo[]
): BillingIssuerInfo | null {
  const name = normalizeCompanyName(companyName ?? '')
  if (!name) return null
  const matches = issuers.filter((issuer) => normalizeCompanyName(issuer.name) === name)
  return matches.length === 1 ? matches[0]! : null
}
