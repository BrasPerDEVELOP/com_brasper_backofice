import { describe, expect, it } from 'vitest'
import { issuerForTransactionCompany } from './resolve_invoice_issuer'
import type { BillingIssuerInfo } from './models'

const issuers: BillingIssuerInfo[] = [
  {
    ruc: '20608550454',
    name: 'BRASPER 21 S.A.C.',
    tradeName: 'brasper transferencias',
    isDefault: true,
    configured: true
  },
  {
    ruc: '20611936428',
    name: 'INGENITECH S.A.C.',
    tradeName: 'brasper transferencias',
    isDefault: false,
    configured: true
  }
]

describe('issuerForTransactionCompany', () => {
  it('selecciona INGENITECH para la razón social de PxB-001832', () => {
    expect(issuerForTransactionCompany(' Ingenitech  S.A.C. ', issuers)?.ruc).toBe('20611936428')
  })

  it('no confunde las empresas por su nombre comercial compartido', () => {
    expect(issuerForTransactionCompany('brasper transferencias', issuers)).toBeNull()
  })

  it('no adivina una empresa si falta la razón social o hay coincidencias duplicadas', () => {
    expect(issuerForTransactionCompany(null, issuers)).toBeNull()
    expect(
      issuerForTransactionCompany('INGENITECH S.A.C.', [
        issuers[1]!,
        { ...issuers[1]!, ruc: '00000000000' }
      ])
    ).toBeNull()
  })
})
