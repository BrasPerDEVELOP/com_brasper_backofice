import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_PERMISSION_KEYS,
  getDefaultPermissionsForRole,
  normalizePermissions,
  roleGrantsPermission
} from './permissions'

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
    expect(permissions).toContain('commissions.view')
    expect(permissions).toContain('commissions.create')
    expect(permissions).toContain('commissions.update')
    expect(permissions).toContain('commissions.delete')
  })

  it('gives accounting every Contabilidad permission so they can open the table', () => {
    const permissions = getDefaultPermissionsForRole('accounting')
    expect(ACCOUNTING_PERMISSION_KEYS.length).toBeGreaterThan(0)
    expect(permissions).toEqual(expect.arrayContaining([...ACCOUNTING_PERMISSION_KEYS]))
  })

  it('keeps the corporate Brasper account CRUD restricted by default', () => {
    expect(getDefaultPermissionsForRole('admin')).toContain('company_bank_accounts.delete')
    expect(getDefaultPermissionsForRole('sales')).not.toContain('company_bank_accounts.view')
    expect(getDefaultPermissionsForRole('accounting')).not.toContain('company_bank_accounts.update')
  })
})

describe('normalizePermissions', () => {
  it('keeps accounting.view even when the API omits Contabilidad keys', () => {
    const permissions = normalizePermissions(['dashboard.view', 'commissions.view'], 'accounting')
    expect(permissions).toContain('dashboard.view')
    expect(permissions).toContain('commissions.view')
    expect(permissions).toEqual(expect.arrayContaining([...ACCOUNTING_PERMISSION_KEYS]))
  })

  it('does not grant Contabilidad access to other roles from a partial API list', () => {
    expect(normalizePermissions(['dashboard.view'], 'sales')).not.toContain('accounting.view')
  })
})

describe('roleGrantsPermission', () => {
  it('lets admin pass every permission check', () => {
    expect(roleGrantsPermission('admin', 'accounting.view')).toBe(true)
    expect(roleGrantsPermission('admin', 'users.delete')).toBe(true)
  })

  it('lets accounting pass every Contabilidad permission even if the list is stale', () => {
    for (const permission of ACCOUNTING_PERMISSION_KEYS) {
      expect(roleGrantsPermission('accounting', permission)).toBe(true)
    }
  })

  it('does not let accounting bypass unrelated modules', () => {
    expect(roleGrantsPermission('accounting', 'blog.delete')).toBe(false)
    expect(roleGrantsPermission('sales', 'accounting.view')).toBe(false)
  })
})
