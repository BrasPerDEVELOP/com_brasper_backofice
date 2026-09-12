import { describe, it, expect } from 'vitest'
import { parseEffectivePermissions, ACCOUNTING_PERMISSION_KEYS } from './permissions'
describe('permisos efectivos', () => {
  it('conserva vacío y no inventa permisos de sesión', () => {
    expect(parseEffectivePermissions([])).toEqual([])
    expect(parseEffectivePermissions(undefined)).toEqual([])
    expect(parseEffectivePermissions(['blog.view', 'blog.view', 'unknown'])).toEqual(['blog.view'])
  })
  it('mantiene el contrato de garantizados compartido con API', () => {
    expect(ACCOUNTING_PERMISSION_KEYS).toEqual(['accounting.view'])
  })
})
