import { describe, expect, it } from 'vitest'
import {
  normalizeUserWorkspaceTab,
  queryString,
  shouldShowUserRoleField
} from './use_user_workspace'

describe('user workspace query helpers', () => {
  it('normalizes the supported account tab', () => {
    expect(normalizeUserWorkspaceTab('accounts')).toBe('accounts')
    expect(normalizeUserWorkspaceTab('unknown')).toBe('profile')
    expect(normalizeUserWorkspaceTab(null)).toBe('profile')
  })

  it('reads scalar and array query values safely', () => {
    expect(queryString(' user-1 ')).toBe('user-1')
    expect(queryString(['user-2', 'ignored'])).toBe('user-2')
    expect(queryString('')).toBeNull()
    expect(queryString(undefined)).toBeNull()
  })
})

describe('user role field visibility', () => {
  it('siempre permite cambiar el rol al editar con permiso', () => {
    expect(
      shouldShowUserRoleField({
        canUpdateUsers: true,
        isEditing: true,
        roleFilter: 'client'
      })
    ).toBe(true)
  })

  it('mantiene el selector oculto sin permiso de actualización', () => {
    expect(
      shouldShowUserRoleField({
        canUpdateUsers: false,
        isEditing: true,
        roleFilter: 'todos'
      })
    ).toBe(false)
  })
})
