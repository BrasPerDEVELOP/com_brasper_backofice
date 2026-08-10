import { beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.mock` se iza sobre las declaraciones, así que el espía se crea dentro de
// la fábrica y se recupera después con `vi.mocked`.
vi.mock('@/interface/api/client', () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  },
  getApiAuthHeaders: () => ({}),
  triggerUnauthorized: vi.fn()
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (p: string) => `https://api.test/${p}` }
}))

import { deleteUser } from './users_management_api_adapter'
import { apiClient } from '@/interface/api/client'

const del = vi.mocked(apiClient.delete)

describe('deleteUser', () => {
  beforeEach(() => del.mockReset())

  it('pide la ruta SIN barra final', async () => {
    // Con barra, FastAPI responde 307 hacia la URL sin ella, el proxy la
    // reescribe a HTTP y el navegador bloquea el DELETE por contenido mixto:
    // el borrado fallaba siempre.
    del.mockResolvedValue({ data: null })
    await deleteUser('abc-123')

    expect(del).toHaveBeenCalledTimes(1)
    const url = del.mock.calls[0][0] as string
    expect(url).toBe('https://api.test/user/abc-123')
    expect(url.endsWith('/')).toBe(false)
  })

  it('recorta el id antes de armar la URL', async () => {
    del.mockResolvedValue({ data: null })
    await deleteUser('  abc-123  ')
    expect(del.mock.calls[0][0]).toBe('https://api.test/user/abc-123')
  })

  it('rechaza un id vacío sin llamar al API', async () => {
    await expect(deleteUser('   ')).rejects.toThrow('ID de usuario inválido')
    expect(del).not.toHaveBeenCalled()
  })

  it('cae al contrato con id en el cuerpo si la ruta REST falla', async () => {
    del.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ data: null })
    await deleteUser('abc-123')

    expect(del).toHaveBeenCalledTimes(2)
    expect(del.mock.calls[1][0]).toBe('https://api.test/user/')
    expect((del.mock.calls[1][1] as { data: unknown }).data).toEqual({ id: 'abc-123' })
  })

  it('si ambos fallan propaga el error del intento REST, no el del respaldo', async () => {
    const primero = new Error('403 sin permiso')
    del.mockRejectedValueOnce(primero).mockRejectedValueOnce(new Error('405'))
    await expect(deleteUser('abc-123')).rejects.toBe(primero)
  })
})
