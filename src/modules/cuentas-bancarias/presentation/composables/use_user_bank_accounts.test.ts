import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { BankAccount } from '../../domain/models'
import type { UserOption } from '../../infrastructure/adapters/users_api_adapter'
import { groupUsersWithBankAccounts, useUserBankAccounts } from './use_user_bank_accounts'

const users: UserOption[] = [
  { id: 'u1', name: 'Ana Souza', email: 'ana@example.com', role: 'client', identifications: [
    { document_type: 'cpf', document_number: '12345678901', is_primary: true },
    { document_type: 'dni', document_number: '87654321', is_primary: false }
  ] },
  { id: 'u2', name: 'Luis Torres', email: 'luis@example.com', role: 'client', identifications: [] }
]

function account(id: string, userId: string, country: 'pe' | 'br'): BankAccount {
  return {
    id, user_id: userId, bank_id: `bank-${country}`, account_flow: 'destination',
    account_holder_type: 'naturalPerson', bank_country: country, holder_names: null,
    holder_surnames: null, document_number: null, business_name: null, ruc_number: null,
    legal_representative_name: null, legal_representative_document: null,
    account_number: null, account_number_confirmation: null, cci_number: null,
    cci_number_confirmation: null, pix_key: null, pix_key_confirmation: null,
    pix_key_type: null, cpf: null
  }
}

describe('groupUsersWithBankAccounts', () => {
  it('incluye usuarios sin cuentas y agrupa varias cuentas por user_id', () => {
    const groups = groupUsersWithBankAccounts(users, [account('a1', 'u1', 'pe'), account('a2', 'u1', 'br')])
    expect(groups[0]?.accounts).toHaveLength(2)
    expect(groups[0]?.countries).toEqual(['BR', 'PE'])
    expect(groups[1]?.accounts).toHaveLength(0)
    expect(groups[1]?.hasAccounts).toBe(false)
  })
})

describe('useUserBankAccounts', () => {
  it('calcula conteos y filtra con/sin cuentas', () => {
    const browser = useUserBankAccounts({ users: ref(users), accounts: ref([account('a1', 'u1', 'br')]) })
    expect(browser.counts.value).toEqual({ all: 2, with: 1, without: 1 })
    browser.statusFilter.value = 'without'
    expect(browser.filteredGroups.value.map((group) => group.user.id)).toEqual(['u2'])
  })

  it('busca por una identificación secundaria', async () => {
    vi.useFakeTimers()
    const browser = useUserBankAccounts({ users: ref(users), accounts: ref([]) })
    browser.searchQuery.value = '87654321'
    await vi.runAllTimersAsync()
    expect(browser.filteredGroups.value.map((group) => group.user.id)).toEqual(['u1'])
    vi.useRealTimers()
  })
})
