import { describe, expect, it } from 'vitest'
import { formatUserPhone, parseUserContacts, normalizeWhatsAppUsername } from './user_phone'

describe('formatUserPhone', () => {
  it('muestra el usuario de WhatsApp sin código telefónico', () => {
    expect(formatUserPhone('@cliente.brasper', '+51')).toBe('@cliente.brasper')
  })
  it('conserva los ceros de un teléfono y su código de país', () => {
    expect(formatUserPhone('001234567', '+55')).toBe('+55 001234567')
  })
})


describe('parseUserContacts', () => {
  it('separa contactos y recupera alias de respuestas antiguas', () => {
    expect(parseUserContacts({ phone: '001234567', whatsapp_username: '@cliente' })).toEqual({ phone: '001234567', whatsapp_username: '@cliente' })
    expect(parseUserContacts({ phone: '@cliente' })).toEqual({ phone: null, whatsapp_username: '@cliente' })
  })
  it('no recupera un alias que fue eliminado del campo nuevo', () => {
    expect(parseUserContacts({ phone: '@viejo', whatsapp_username: null })).toEqual({ phone: null, whatsapp_username: null })
  })
})


describe('normalizeWhatsAppUsername', () => {
  it.each(['cliente', '@cliente', '@@cliente', ' @cliente '])('añade un solo @ a %s', value => {
    expect(normalizeWhatsAppUsername(value)).toBe('@cliente')
  })
  it.each(['', '@', '@@', '  '])('no guarda un prefijo vacío: %s', value => {
    expect(normalizeWhatsAppUsername(value)).toBeNull()
  })
})
