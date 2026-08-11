import { describe, expect, it } from 'vitest'
import { buildGoogleAuthorizeUrl, resolveGoogleCallback } from './google_oauth'

const AUTHORIZE_INPUT = {
  clientId: '1234567890-abc.apps.googleusercontent.com',
  redirectUri: 'https://dashboard.brasper.com/',
  state: 'abc123',
  scope: 'openid email profile'
}

describe('buildGoogleAuthorizeUrl', () => {
  it('arma el diálogo OAuth con response_type=code', () => {
    const url = new URL(buildGoogleAuthorizeUrl(AUTHORIZE_INPUT))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('1234567890-abc.apps.googleusercontent.com')
    expect(url.searchParams.get('redirect_uri')).toBe('https://dashboard.brasper.com/')
    expect(url.searchParams.get('state')).toBe('abc123')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('response_type')).toBe('code')
  })

  it('pide el selector de cuenta para no reusar la sesión de Google activa', () => {
    const url = new URL(buildGoogleAuthorizeUrl(AUTHORIZE_INPUT))
    expect(url.searchParams.get('prompt')).toBe('select_account')
  })
})

describe('resolveGoogleCallback', () => {
  it('ignora la query cuando esta pestaña no inició el flujo', () => {
    const search = new URLSearchParams({ code: '4/0AX123', state: 'abc123' })
    expect(resolveGoogleCallback(search, null)).toEqual({ status: 'ignored' })
  })

  it('ignora la query cuando no hay code ni error', () => {
    expect(resolveGoogleCallback(new URLSearchParams({ tab: 'accounts' }), 'abc123')).toEqual({
      status: 'ignored'
    })
  })

  it('acepta el code cuando el state coincide', () => {
    const search = new URLSearchParams({ code: '4/0AX123', state: 'abc123' })
    expect(resolveGoogleCallback(search, 'abc123')).toEqual({
      status: 'ready',
      code: '4/0AX123'
    })
  })

  it('rechaza el code cuando el state no coincide (CSRF)', () => {
    const search = new URLSearchParams({ code: '4/0AX123', state: 'otro' })
    expect(resolveGoogleCallback(search, 'abc123').status).toBe('failed')
  })

  it('rechaza el code cuando falta el state en la respuesta', () => {
    expect(resolveGoogleCallback(new URLSearchParams({ code: '4/0AX123' }), 'abc123').status).toBe(
      'failed'
    )
  })

  it('propaga la descripción del error de Google', () => {
    const search = new URLSearchParams({
      error: 'access_denied',
      error_description: 'The+user+denied+access',
      state: 'abc123'
    })
    expect(resolveGoogleCallback(search, 'abc123')).toEqual({
      status: 'failed',
      message: 'Google rechazó el acceso: The user denied access'
    })
  })

  it('usa un mensaje genérico si Google no describe el error', () => {
    const search = new URLSearchParams({ error: 'access_denied', state: 'abc123' })
    expect(resolveGoogleCallback(search, 'abc123')).toEqual({
      status: 'failed',
      message: 'No se completó el inicio de sesión con Google.'
    })
  })
})
