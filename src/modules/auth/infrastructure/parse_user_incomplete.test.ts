import { describe, expect, it } from 'vitest'
import {
  isClientProfileIncomplete,
  missingProfileFields,
  type UserListItem
} from './parse_user'

const user = (over: Partial<UserListItem> = {}): UserListItem => ({
  id: 'u1',
  name: 'Esperanza Tello',
  email: '',
  identifications: [],
  ...over
})

describe('perfil incompleto derivado', () => {
  it('un alta rápida (solo nombre) queda incompleta', () => {
    expect(isClientProfileIncomplete(user())).toBe(true)
  })

  it('con email ya no está incompleta', () => {
    expect(isClientProfileIncomplete(user({ email: 'a@b.com' }))).toBe(false)
  })

  it('con documento tampoco', () => {
    expect(isClientProfileIncomplete(user({ document_number: '12345678' }))).toBe(false)
  })

  it('un documento en identifications también cuenta', () => {
    const u = user({
      identifications: [{ document_type: 'dni', document_number: '12345678', is_primary: true }]
    })
    expect(isClientProfileIncomplete(u)).toBe(false)
  })

  it('campos en blanco no cuentan como datos', () => {
    const u = user({
      email: '   ',
      document_number: '  ',
      identifications: [{ document_type: 'dni', document_number: '  ', is_primary: true }]
    })
    expect(isClientProfileIncomplete(u)).toBe(true)
  })

  it('solo teléfono sigue siendo incompleto', () => {
    expect(isClientProfileIncomplete(user({ phone: 987654321 }))).toBe(true)
  })
})

describe('qué falta en el perfil', () => {
  it('un alta rápida con solo nombre lista todo lo pendiente', () => {
    expect(missingProfileFields(user())).toEqual([
      'email',
      'apellidos',
      'documento',
      'teléfono'
    ])
  })

  it('no lista lo que ya está', () => {
    const u = user({
      email: 'a@b.com',
      lastnames: 'Tello',
      phone: 987654321,
      identifications: [{ document_type: 'dni', document_number: '123', is_primary: true }]
    })
    expect(missingProfileFields(u)).toEqual([])
  })

  it('el teléfono cuenta como presente aunque el resto falte', () => {
    expect(missingProfileFields(user({ phone: 987654321 }))).not.toContain('teléfono')
  })

  it('un documento en blanco sigue contando como faltante', () => {
    const u = user({
      identifications: [{ document_type: 'dni', document_number: '   ', is_primary: true }]
    })
    expect(missingProfileFields(u)).toContain('documento')
  })
})
