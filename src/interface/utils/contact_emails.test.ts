import { describe, expect, it } from 'vitest'
import { contactEmails, uniqueEmails, unsentEmails } from './contact_emails'

describe('contact emails', () => {
  it('preserva el principal y elimina duplicados sin distinguir mayúsculas', () => {
    expect(contactEmails(['otro@example.com', 'MAIN@example.com', null], ' main@example.com '))
      .toEqual(['main@example.com', 'otro@example.com'])
    expect(contactEmails(undefined, '-')).toEqual([])
  })
  it('excluye destinatarios ya enviados y une contactos con extras', () => {
    expect(unsentEmails(uniqueEmails(['first@example.com', 'extra@example.com', 'EXTRA@example.com', '']), ['FIRST@example.com']))
      .toEqual(['extra@example.com'])
  })
})
