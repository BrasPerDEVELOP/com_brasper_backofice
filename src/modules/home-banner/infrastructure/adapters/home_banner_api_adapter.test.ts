import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/interface/api/client', () => ({
  apiClient: { request: vi.fn() }
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '') }
}))

import { apiClient } from '@/interface/api/client'
import { HomeBannerApiAdapter } from './home_banner_api_adapter'

function formEntries(body: unknown): Record<string, string> {
  if (!(body instanceof FormData)) throw new Error('Expected FormData body')
  const out: Record<string, string> = {}
  for (const [key, value] of body.entries()) {
    out[key] = value instanceof File ? `file:${value.name}` : String(value)
  }
  return out
}

const SERVER_BANNER = {
  id: '42',
  banner_es: 'home_banner/es.webp',
  banner_pr: 'home_banner/pr.webp',
  banner_en: 'home_banner/en.webp',
  enable: true,
  updated_at: '2026-07-06T00:00:00Z'
}

describe('HomeBannerApiAdapter', () => {
  let adapter: HomeBannerApiAdapter

  beforeEach(() => {
    adapter = new HomeBannerApiAdapter()
    vi.mocked(apiClient.request).mockReset()
  })

  it('envía PUT multipart por la ruta canónica protegida', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: SERVER_BANNER })
    const file = new File(['x'], 'nuevo.webp', { type: 'image/webp' })

    const result = await adapter.updateBanner({
      id: '42',
      enable: true,
      banner_es: file,
      banner_pr: 'home_banner/pr.webp',
      banner_en: null
    })

    const config = vi.mocked(apiClient.request).mock.calls[0]?.[0]
    expect(config?.url).toBe('home-banner/home-image')
    expect(config?.method).toBe('PUT')
    expect(formEntries(config?.data)).toEqual({
      id: '42',
      enable: 'true',
      banner_es: 'file:nuevo.webp',
      banner_pr: 'home_banner/pr.webp'
    })
    expect(result.id).toBe('42')
  })

  it('propaga el mensaje de error del backend', async () => {
    vi.mocked(apiClient.request).mockRejectedValue({
      response: { status: 400, data: { detail: 'archivo inválido' } }
    })
    await expect(adapter.updateBanner({ id: '42', enable: true })).rejects.toThrow(
      'archivo inválido'
    )
  })

  it('lanza error cuando la respuesta no contiene un banner válido', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: { ok: true } })
    await expect(adapter.updateBanner({ id: '42', enable: true })).rejects.toThrow(
      'Respuesta de guardado de banner inválida'
    )
  })

  it('desempaqueta el banner cuando viene dentro de data', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: { data: SERVER_BANNER } })
    const result = await adapter.updateBanner({ id: '42', enable: true })
    expect(result.id).toBe('42')
  })

  it('envía POST multipart sin id', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: SERVER_BANNER })
    const file = new File(['x'], 'es.webp', { type: 'image/webp' })
    await adapter.createBanner({ enable: false, banner_es: file, banner_pr: null, banner_en: null })

    const config = vi.mocked(apiClient.request).mock.calls[0]?.[0]
    expect(config?.method).toBe('POST')
    expect(formEntries(config?.data)).toEqual({ enable: 'false', banner_es: 'file:es.webp' })
  })

  it('hace GET público y devuelve el primer elemento', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: [SERVER_BANNER] })
    const result = await adapter.getBanner()
    expect(vi.mocked(apiClient.request).mock.calls[0]?.[0]).toMatchObject({
      url: 'home-banner/home-image',
      method: 'GET'
    })
    expect(result?.id).toBe('42')
  })

  it('devuelve null cuando no hay banner', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: null })
    expect(await adapter.getBanner()).toBeNull()
  })
})
