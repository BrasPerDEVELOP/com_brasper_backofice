import { describe, expect, it } from 'vitest'
import { buildFacebookAuthorizeUrl, resolveFacebookCallback } from './facebook_oauth'

const AUTHORIZE_INPUT = {
  appId: '1234567890',
  redirectUri: 'https://dashboard.brasper.com/',
  state: 'abc123',
  scope: 'email,public_profile',
  apiVersion: 'v19.0'
}

describe('buildFacebookAuthorizeUrl', () => {
  it('arma el diálogo OAuth con response_type=code', () => {
    const url = new URL(buildFacebookAuthorizeUrl(AUTHORIZE_INPUT))
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v19.0/dialog/oauth')
    expect(url.searchParams.get('client_id')).toBe('1234567890')
    expect(url.searchParams.get('redirect_uri')).toBe('https://dashboard.brasper.com/')
    expect(url.searchParams.get('state')).toBe('abc123')
    expect(url.searchParams.get('scope')).toBe('email,public_profile')
    expect(url.searchParams.get('response_type')).toBe('code')
  })

  it('normaliza la versión sin prefijo v', () => {
    const url = buildFacebookAuthorizeUrl({ ...AUTHORIZE_INPUT, apiVersion: '20.0' })
    expect(url).toContain('/v20.0/dialog/oauth')
  })
})

describe('resolveFacebookCallback', () => {
  it('ignora la query cuando esta pestaña no inició el flujo', () => {
    const search = new URLSearchParams({ code: 'AQD123', state: 'abc123' })
    expect(resolveFacebookCallback(search, null)).toEqual({ status: 'ignored' })
  })

  it('ignora la query cuando no hay code ni error', () => {
    expect(resolveFacebookCallback(new URLSearchParams({ tab: 'accounts' }), 'abc123')).toEqual({
      status: 'ignored'
    })
  })

  it('acepta el code cuando el state coincide', () => {
    const search = new URLSearchParams({ code: 'AQD123', state: 'abc123' })
    expect(resolveFacebookCallback(search, 'abc123')).toEqual({ status: 'ready', code: 'AQD123' })
  })

  it('rechaza el code cuando el state no coincide (CSRF)', () => {
    const search = new URLSearchParams({ code: 'AQD123', state: 'otro' })
    const result = resolveFacebookCallback(search, 'abc123')
    expect(result.status).toBe('failed')
  })

  it('rechaza el code cuando falta el state en la respuesta', () => {
    const result = resolveFacebookCallback(new URLSearchParams({ code: 'AQD123' }), 'abc123')
    expect(result.status).toBe('failed')
  })

  it('propaga la descripción del error de Facebook', () => {
    const search = new URLSearchParams({
      error: 'access_denied',
      error_description: 'Permissions+error',
      state: 'abc123'
    })
    expect(resolveFacebookCallback(search, 'abc123')).toEqual({
      status: 'failed',
      message: 'Facebook rechazó el acceso: Permissions error'
    })
  })

  it('usa un mensaje genérico si Facebook no describe el error', () => {
    const search = new URLSearchParams({ error_code: '100', state: 'abc123' })
    const result = resolveFacebookCallback(search, 'abc123')
    expect(result).toEqual({
      status: 'failed',
      message: 'No se completó el inicio de sesión con Facebook.'
    })
  })
})
