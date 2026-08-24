import { describe, expect, it } from 'vitest'
import { getDefaultPermissionsForRole } from './permissions'

describe('default role permissions', () => {
  it('allows sales advisors to attach and update client bank accounts', () => {
    const permissions = getDefaultPermissionsForRole('sales')
    expect(permissions).toContain('bank_accounts.view')
    expect(permissions).toContain('bank_accounts.create')
    expect(permissions).toContain('bank_accounts.update')
    expect(permissions).not.toContain('bank_accounts.delete')
    expect(permissions).not.toContain('company_bank_accounts.view')
  })

  it('allows accounting to fully manage users and client bank accounts', () => {
    const permissions = getDefaultPermissionsForRole('accounting')
    expect(permissions).toContain('users.view')
    expect(permissions).toContain('users.create')
    expect(permissions).toContain('users.update')
    expect(permissions).toContain('users.delete')
    expect(permissions).toContain('users.reset_password')
    expect(permissions).toContain('bank_accounts.view')
    expect(permissions).toContain('bank_accounts.create')
    expect(permissions).toContain('bank_accounts.update')
    expect(permissions).toContain('bank_accounts.delete')
  })

  it('keeps the corporate Brasper account CRUD restricted by default', () => {
    expect(getDefaultPermissionsForRole('admin')).toContain('company_bank_accounts.delete')
    expect(getDefaultPermissionsForRole('sales')).not.toContain('company_bank_accounts.view')
    expect(getDefaultPermissionsForRole('accounting')).not.toContain('company_bank_accounts.update')
  })
})
