import { describe, it, expect } from 'vitest'
import { Domain } from './domain'

describe('Domain.buildWsUrl', () => {
  it('genera ws:// o wss:// canónico a partir de la ruta relativa', () => {
    const url = Domain.buildWsUrl('ws/transactions/')
    expect(url).toMatch(/^wss?:\/\//)
    expect(url).toContain('/ws/transactions')
  })

  it('adjunta el token como query param si se provee', () => {
    const url = Domain.buildWsUrl('ws/transactions/', 'jwt.token.abc')
    expect(url).toContain('token=jwt.token.abc')
  })

  it('no adjunta token si es nulo o vacío', () => {
    const url = Domain.buildWsUrl('ws/transactions/', null)
    expect(url).not.toContain('token=')
  })
})
