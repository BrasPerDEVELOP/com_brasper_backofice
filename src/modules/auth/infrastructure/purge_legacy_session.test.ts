import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purgeLegacySession } from './purge_legacy_session'

function stubLocalStorage(removeItem: (key: string) => void): void {
  vi.stubGlobal('localStorage', { removeItem } as unknown as Storage)
}

describe('purgeLegacySession', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('borra el token y el perfil que guardaban las versiones anteriores', () => {
    const removed: string[] = []
    stubLocalStorage((key) => removed.push(key))

    purgeLegacySession()

    expect(removed).toEqual(['token', 'auth_user'])
  })

  it('no rompe el arranque si localStorage lanza (modo privado)', () => {
    stubLocalStorage(() => {
      throw new Error('acceso denegado')
    })

    expect(() => purgeLegacySession()).not.toThrow()
  })
})
