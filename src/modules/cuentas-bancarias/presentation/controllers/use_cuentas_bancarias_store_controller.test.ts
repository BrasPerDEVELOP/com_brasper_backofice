import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { BankAccount } from '../../domain/models'
import { useCuentasBancariasStore } from './use_cuentas_bancarias_store_controller'

const { deleteBankAccountMock } = vi.hoisted(() => ({ deleteBankAccountMock: vi.fn() }))

vi.mock('../../infrastructure/adapters', () => ({
  CuentasBancariasApiAdapter: class {
    deleteBankAccount(id: string) {
      return deleteBankAccountMock(id)
    }
  }
}))

function account(id: string, userId: string): BankAccount {
  return {
    id,
    user_id: userId,
    bank_id: 'b1',
    account_flow: 'destination',
    account_holder_type: 'naturalPerson',
    bank_country: 'pe',
    holder_names: null,
    holder_surnames: null,
    document_number: null,
    business_name: null,
    ruc_number: null,
    legal_representative_name: null,
    legal_representative_document: null,
    account_number: null,
    account_number_confirmation: null,
    cci_number: null,
    cci_number_confirmation: null,
    pix_key: null,
    pix_key_confirmation: null,
    pix_key_type: null,
    cpf: null,
    created_at: undefined,
    created_by: null,
    updated_at: undefined
  }
}

describe('useCuentasBancariasStore.deleteBankAccount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    deleteBankAccountMock.mockReset()
    deleteBankAccountMock.mockResolvedValue(undefined)
  })

  function seed() {
    const store = useCuentasBancariasStore()
    store.bankAccounts = [account('a1', 'u1'), account('a2', 'u1'), account('a3', 'u2')]
    store.bankAccountsByUser = {
      u1: [account('a1', 'u1'), account('a2', 'u1')],
      u2: [account('a3', 'u2')]
    }
    store.transactionFormBankAccounts = [account('a1', 'u1'), account('a2', 'u1')]
    store.transactionFormBankAccountsUserId = 'u1'
    return store
  }

  it('elimina la cuenta de la lista principal y de los cachés por usuario y de transacciones', async () => {
    const store = seed()

    await store.deleteBankAccount('a1')

    expect(deleteBankAccountMock).toHaveBeenCalledWith('a1')
    expect(store.bankAccounts.map((a) => a.id)).toEqual(['a2', 'a3'])
    expect(store.bankAccountsByUser.u1.map((a) => a.id)).toEqual(['a2'])
    expect(store.transactionFormBankAccounts.map((a) => a.id)).toEqual(['a2'])
    expect(store.isDeleting).toBe(false)
    expect(store.error).toBeNull()
  })

  it('no reemplaza los cachés de usuarios que no contienen la cuenta', async () => {
    const store = seed()
    const otherUserCache = store.bankAccountsByUser.u2

    await store.deleteBankAccount('a1')

    expect(store.bankAccountsByUser.u2).toBe(otherUserCache)
  })

  it('propaga el error, guarda el mensaje y no toca los cachés', async () => {
    const store = seed()
    deleteBankAccountMock.mockRejectedValue(new Error('403 Forbidden'))

    await expect(store.deleteBankAccount('a1')).rejects.toThrow('403 Forbidden')

    expect(store.error).toBe('403 Forbidden')
    expect(store.bankAccounts.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
    expect(store.bankAccountsByUser.u1.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(store.transactionFormBankAccounts.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(store.isDeleting).toBe(false)
  })
})
