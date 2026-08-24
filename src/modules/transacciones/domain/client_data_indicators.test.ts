import { describe, expect, it } from 'vitest'
import { resolveMissingClientData } from './client_data_indicators'

describe('resolveMissingClientData', () => {
  it('devuelve los faltantes confirmados', () => {
    expect(
      resolveMissingClientData({ has_email: false, has_phone: false }, 'user-1', {
        bankAccountOwnerIds: new Set(),
        canInspectBankAccounts: true,
        bankAccountsReady: true
      })
    ).toEqual(['email', 'phone', 'bank_account'])
  })

  it('no marca cuentas cuando el catálogo no está listo o no hay permiso', () => {
    const user = { has_email: true, has_phone: true }
    expect(
      resolveMissingClientData(user, 'user-1', {
        bankAccountOwnerIds: new Set(),
        canInspectBankAccounts: true,
        bankAccountsReady: false
      })
    ).toEqual([])
    expect(
      resolveMissingClientData(user, 'user-1', {
        bankAccountOwnerIds: new Set(),
        canInspectBankAccounts: false,
        bankAccountsReady: true
      })
    ).toEqual([])
  })

  it('no inventa faltantes si el usuario aún no fue resuelto', () => {
    expect(
      resolveMissingClientData(undefined, 'user-1', {
        bankAccountOwnerIds: new Set(),
        canInspectBankAccounts: true,
        bankAccountsReady: true
      })
    ).toEqual([])
  })
})
