import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './use_auth_store_controller'
import type { User } from '../../domain/models'

function user(over: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'conta@brasper.com',
    names: 'Ana',
    lastnames: 'Contable',
    name: 'Ana Contable',
    document_number: null,
    document_type: null,
    profile_image: null,
    is_agent: false,
    role: 'accounting',
    phone: null,
    code_phone: null,
    permissions: ['dashboard.view'],
    must_change_password: false,
    ...over
  }
}

describe('auth store permissions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('lets the accounting role open Contabilidad even if accounting.view is missing from the list', () => {
    const store = useAuthStore()
    store.user = user({ role: 'accounting', permissions: ['dashboard.view'] })
    expect(store.hasPermission('accounting.view')).toBe(true)
  })

  it('does not let sales open Contabilidad without accounting.view', () => {
    const store = useAuthStore()
    store.user = user({ role: 'sales', permissions: ['dashboard.view', 'transactions.view'] })
    expect(store.hasPermission('accounting.view')).toBe(false)
  })
})
