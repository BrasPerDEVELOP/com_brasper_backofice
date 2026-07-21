import { describe, it, expect } from 'vitest'
import { parseUser, parseUserListItem } from './parse_user'

describe('parseUser (dominio)', () => {
  it('devuelve null para payloads no-objeto', () => {
    expect(parseUser(null)).toBeNull()
    expect(parseUser(undefined)).toBeNull()
    expect(parseUser('x')).toBeNull()
    expect(parseUser(42)).toBeNull()
  })

  it('devuelve null si falta id', () => {
    expect(parseUser({ email: 'a@b.com' })).toBeNull()
  })

  it('acepta user_id como alias de id', () => {
    expect(parseUser({ user_id: 7 })?.id).toBe('7')
  })

  it('normaliza el rol a minúsculas para roles conocidos', () => {
    expect(parseUser({ id: 1, role: 'Admin' })?.role).toBe('admin')
    expect(parseUser({ id: 1, role: 'SALES' })?.role).toBe('sales')
  })

  it('construye el nombre desde names + lastnames, con fallback a email', () => {
    expect(parseUser({ id: 1, names: 'Ana', lastnames: 'Pérez' })?.name).toBe('Ana Pérez')
    expect(parseUser({ id: 1, email: 'ana@b.com' })?.name).toBe('ana@b.com')
  })

  it('resuelve alias de email, phone, document_type y code_phone', () => {
    const u = parseUser({
      id: 1,
      username: 'via-username@b.com',
      telefono: '999',
      documentType: 'DNI',
      codigo_telefono: '+51'
    })
    expect(u?.email).toBe('via-username@b.com')
    expect(u?.phone).toBe(999)
    expect(u?.document_type).toBe('DNI')
    expect(u?.code_phone).toBe('+51')
  })

  it('normaliza varias identificaciones y conserva una sola principal', () => {
    const user = parseUserListItem({
      id: 'user-2',
      identifications: [
        { document_type: 'dni', document_number: '12345678', is_primary: true },
        { type: 'cpf', number: '12345678901', primary: true }
      ]
    })

    expect(user?.document_type).toBe('dni')
    expect(user?.document_number).toBe('12345678')
    expect(user?.identifications).toEqual([
      { document_type: 'dni', document_number: '12345678', is_primary: true },
      { document_type: 'cpf', document_number: '12345678901', is_primary: false }
    ])
  })

  it('convierte el documento antiguo en una identificación principal', () => {
    const user = parseUserListItem({
      id: 'user-3',
      document_type: 'cpf',
      document_number: '12345678901'
    })

    expect(user?.identifications).toEqual([
      { document_type: 'cpf', document_number: '12345678901', is_primary: true }
    ])
  })

  it('acepta los alias documents/documentos y tipo/numero en español', () => {
    const user = parseUserListItem({
      id: 'user-4',
      documentos: [
        { tipo_documento: 'dni', numero_documento: '12345678' },
        { tipo_documento: 'cpf', numero_documento: '999' }
      ]
    })

    expect(user?.identifications).toEqual([
      { document_type: 'dni', document_number: '12345678', is_primary: true },
      { document_type: 'cpf', document_number: '999', is_primary: false }
    ])
  })

  it('no duplica el documento heredado si ya está en la lista', () => {
    const user = parseUserListItem({
      id: 'user-5',
      document_type: 'dni',
      document_number: '12345678',
      identifications: [
        { document_type: 'dni', document_number: '12345678' },
        { document_type: 'cpf', document_number: '999' }
      ]
    })

    expect(user?.identifications).toEqual([
      { document_type: 'dni', document_number: '12345678', is_primary: true },
      { document_type: 'cpf', document_number: '999', is_primary: false }
    ])
  })

  it('antepone el documento heredado cuando no está en la lista', () => {
    const user = parseUserListItem({
      id: 'user-6',
      document_type: 'dni',
      document_number: '12345678',
      identifications: [{ document_type: 'cpf', document_number: '999', is_primary: true }]
    })

    expect(user?.identifications).toEqual([
      { document_type: 'dni', document_number: '12345678', is_primary: true },
      { document_type: 'cpf', document_number: '999', is_primary: false }
    ])
  })

  it('promueve la primera fila cuando ninguna identificación es principal', () => {
    const user = parseUserListItem({
      id: 'user-7',
      identifications: [
        { document_type: 'dni', document_number: '111', is_primary: false },
        { document_type: 'cpf', document_number: '222', is_primary: false }
      ]
    })

    expect(user?.identifications[0]?.is_primary).toBe(true)
    expect(user?.identifications[1]?.is_primary).toBe(false)
    expect(user?.document_number).toBe('111')
  })

  it('devuelve una lista vacía cuando no hay documentos', () => {
    const user = parseUserListItem({ id: 'user-8' })
    expect(user?.identifications).toEqual([])
    expect(user?.document_number).toBeUndefined()
    expect(user?.document_type).toBeUndefined()
  })

  it('deriva permisos por rol cuando no vienen en el payload', () => {
    const u = parseUser({ id: 1, role: 'admin' })
    expect(Array.isArray(u?.permissions)).toBe(true)
    expect(u?.permissions.length).toBeGreaterThan(0)
  })
})

describe('parseUserListItem (listado)', () => {
  it('devuelve null para payloads inválidos o sin id', () => {
    expect(parseUserListItem(null)).toBeNull()
    expect(parseUserListItem({ email: 'a@b.com' })).toBeNull()
  })

  it('mantiene el rol en crudo (sin normalizar)', () => {
    expect(parseUserListItem({ id: 1, role: 'Admin' })?.role).toBe('Admin')
  })

  it('aplica fallbacks de listado: email "-" y name = id', () => {
    const u = parseUserListItem({ id: 9 })
    expect(u?.email).toBe('-')
    expect(u?.name).toBe('9')
  })

  it('recorta nombres y arma el nombre completo', () => {
    const u = parseUserListItem({ id: 1, names: '  Ana ', lastnames: ' Pérez ' })
    expect(u?.name).toBe('Ana Pérez')
    expect(u?.names).toBe('Ana')
  })

  it('parsea phone string a número y null si no es válido', () => {
    expect(parseUserListItem({ id: 1, phone: '555' })?.phone).toBe(555)
    expect(parseUserListItem({ id: 1, phone: '' })?.phone).toBeNull()
  })
})
