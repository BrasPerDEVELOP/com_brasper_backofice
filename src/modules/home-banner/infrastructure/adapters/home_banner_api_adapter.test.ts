import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiClientGet, getApiAuthHeaders, triggerUnauthorized } = vi.hoisted(() => ({
  apiClientGet: vi.fn(),
  getApiAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  triggerUnauthorized: vi.fn()
}))

vi.mock('@/interface/api/client', () => ({
  apiClient: { get: apiClientGet },
  getApiAuthHeaders,
  triggerUnauthorized
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: {
    apiUrl: (path: string) => `https://api.test/${path}`
  }
}))

import { HomeBannerApiAdapter } from './home_banner_api_adapter'

const ENDPOINT = 'https://api.test/home-banner/home-image/'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function formEntries(init: RequestInit | undefined): Record<string, string> {
  const body = init?.body
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
  const fetchMock = vi.fn()
  let adapter: HomeBannerApiAdapter

  beforeEach(() => {
    adapter = new HomeBannerApiAdapter()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    apiClientGet.mockReset()
    getApiAuthHeaders.mockClear()
    triggerUnauthorized.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('updateBanner', () => {
    it('envía PUT multipart con id, enable y solo los campos presentes', async () => {
      fetchMock.mockResolvedValue(jsonResponse(SERVER_BANNER))
      const file = new File(['x'], 'nuevo.webp', { type: 'image/webp' })

      const result = await adapter.updateBanner({
        id: '42',
        enable: true,
        banner_es: file,
        banner_pr: 'home_banner/pr.webp',
        banner_en: null
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(ENDPOINT)
      expect(init.method).toBe('PUT')
      expect(init.headers).toEqual({ Authorization: 'Bearer test-token' })

      const fields = formEntries(init)
      expect(fields).toEqual({
        id: '42',
        enable: 'true',
        banner_es: 'file:nuevo.webp',
        banner_pr: 'home_banner/pr.webp'
      })
      expect(fields.banner_en).toBeUndefined()
      expect(result.id).toBe('42')
    })

    it('no cierra sesión cuando el backend responde 401', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'sin token' }, 401))

      await expect(
        adapter.updateBanner({ id: '42', enable: true })
      ).rejects.toThrow('sin token')

      expect(triggerUnauthorized).not.toHaveBeenCalled()
    })

    it('no cierra sesión cuando el backend responde 403', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'prohibido' }, 403))

      await expect(
        adapter.updateBanner({ id: '42', enable: true })
      ).rejects.toThrow('prohibido')

      expect(triggerUnauthorized).not.toHaveBeenCalled()
    })

    it('propaga el mensaje de error en respuestas no exitosas', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'archivo inválido' }, 400))

      await expect(
        adapter.updateBanner({ id: '42', enable: true })
      ).rejects.toThrow('archivo inválido')
    })

    it('lanza error cuando la respuesta no contiene un banner válido', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

      await expect(
        adapter.updateBanner({ id: '42', enable: true })
      ).rejects.toThrow('Respuesta de guardado de banner inválida')
    })

    it('desempaqueta el banner cuando viene dentro de data', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: SERVER_BANNER }))

      const result = await adapter.updateBanner({ id: '42', enable: true })
      expect(result.id).toBe('42')
      expect(result.banner_es).toBe('home_banner/es.webp')
    })
  })

  describe('createBanner', () => {
    it('envía POST multipart sin id y adjunta solo archivos', async () => {
      fetchMock.mockResolvedValue(jsonResponse(SERVER_BANNER))
      const file = new File(['x'], 'es.webp', { type: 'image/webp' })

      await adapter.createBanner({
        enable: false,
        banner_es: file,
        banner_pr: null,
        banner_en: null
      })

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(ENDPOINT)
      expect(init.method).toBe('POST')
      const fields = formEntries(init)
      expect(fields).toEqual({ enable: 'false', banner_es: 'file:es.webp' })
      expect(fields.id).toBeUndefined()
    })
  })

  describe('getBanner', () => {
    it('usa skipAuthRedirect y devuelve el primer elemento de un arreglo', async () => {
      apiClientGet.mockResolvedValue({ data: [SERVER_BANNER] })

      const result = await adapter.getBanner()

      expect(apiClientGet).toHaveBeenCalledWith('home-banner/home-image/', {
        skipAuthRedirect: true
      })
      expect(result?.id).toBe('42')
    })

    it('devuelve null cuando no hay banner', async () => {
      apiClientGet.mockResolvedValue({ data: null })
      expect(await adapter.getBanner()).toBeNull()
    })
  })
})
