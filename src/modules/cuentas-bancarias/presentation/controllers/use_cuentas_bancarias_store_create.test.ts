import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { BankAccount } from '../../domain/models'
import type { CreateBankAccountPayload } from '../../infrastructure/adapters/cuentas_bancarias_repository'
import { useCuentasBancariasStore } from './use_cuentas_bancarias_store_controller'

const { createBankAccountMock } = vi.hoisted(() => ({ createBankAccountMock: vi.fn() }))

vi.mock('../../infrastructure/adapters', () => ({
  CuentasBancariasApiAdapter: class {
    createBankAccount(payload: CreateBankAccountPayload) {
      return createBankAccountMock(payload)
    }
    deleteBankAccount() {
      return Promise.resolve()
    }
  }
}))

vi.mock('@modules/auth/presentation/controllers/use_auth_store_controller', () => ({
  useAuthStore: () => ({ user: { id: 'u1' } })
}))

function createSampleAccount(id: string, userId: string, name: string): BankAccount {
  return {
    id,
    user_id: userId,
    bank_id: 'b1',
    account_flow: 'destination',
    account_holder_type: 'naturalPerson',
    bank_country: 'pe',
    holder_names: name,
    holder_surnames: 'Tello',
    document_number: '12345678',
    business_name: null,
    ruc_number: null,
    legal_representative_name: null,
    legal_representative_document: null,
    account_number: '001101234567890123',
    account_number_confirmation: '001101234567890123',
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

describe('useCuentasBancariasStore.createBankAccount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createBankAccountMock.mockReset()
  })

  it('evita duplicados al incorporar la respuesta de creación usando su id estable', async () => {
    const store = useCuentasBancariasStore()
    const newAccount = createSampleAccount('acc-1', 'u1', 'Esperanza')
    createBankAccountMock.mockResolvedValue(newAccount)

    const payload: CreateBankAccountPayload = {
      user_id: 'u1',
      bank_id: 'b1',
      account_flow: 'destination',
      account_holder_type: 'naturalPerson',
      bank_country: 'pe',
      holder_names: 'Esperanza'
    }

    // Primera llamada
    const result1 = await store.createBankAccount(payload)
    expect(result1.id).toBe('acc-1')
    expect(store.bankAccounts.length).toBe(1)
    expect(store.bankAccounts[0]?.id).toBe('acc-1')

    // Si se reincorporara la misma respuesta (o respuesta duplicada con el mismo ID)
    const result2 = await store.createBankAccount(payload)
    expect(result2.id).toBe('acc-1')
    expect(store.bankAccounts.length).toBe(1)
    expect(store.bankAccounts[0]?.id).toBe('acc-1')
  })

  it('permite contactos/cuentas legítimas que comparten nombre pero tienen IDs distintos', async () => {
    const store = useCuentasBancariasStore()
    const account1 = createSampleAccount('acc-1', 'u1', 'Esperanza')
    const account2 = createSampleAccount('acc-2', 'u1', 'Esperanza')

    createBankAccountMock
      .mockResolvedValueOnce(account1)
      .mockResolvedValueOnce(account2)

    const payload: CreateBankAccountPayload = {
      user_id: 'u1',
      bank_id: 'b1',
      account_flow: 'destination',
      account_holder_type: 'naturalPerson',
      bank_country: 'pe',
      holder_names: 'Esperanza'
    }

    await store.createBankAccount(payload)
    await store.createBankAccount(payload)

    expect(store.bankAccounts.length).toBe(2)
    expect(store.bankAccounts.map((a) => a.id)).toEqual(['acc-2', 'acc-1'])
  })
})
