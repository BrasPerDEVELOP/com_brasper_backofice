import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketingApiAdapter } from './marketing_api_adapter'
import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'

vi.mock('@/interface/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))

describe('Marketing email templates', () => {
  beforeEach(() => vi.clearAllMocks())
  it('persists the selected design along with the campaign message', async () => {
    const input = {
      request_id: 'e6c143fb-98e2-4389-80b7-8177ad736637',
      name: 'Brasil',
      subject: 'Olá',
      body: 'Mensagem',
      emails: ['a@example.com'],
      consent_confirmed: true,
      template_key: 'brasper_peru_pt_v1' as const
    }
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'campaign', ...input } })
    await new MarketingApiAdapter().dispatch(input)
    expect(apiClient.post).toHaveBeenCalledWith(Domain.apiPath('marketing/dispatch'), input)
  })
  it('requests the server-rendered preview rather than rebuilding the email in the browser', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { html: '<html>Rendered preview</html>' } })
    const input = { template_key: 'brasper_peru_pt_v1' as const, subject: 'Olá', body: 'Mensagem' }
    expect(await new MarketingApiAdapter().preview(input)).toBe('<html>Rendered preview</html>')
    expect(apiClient.post).toHaveBeenCalledWith(Domain.apiPath('marketing/preview'), input)
  })
  it('sends an unsaved test without creating or dispatching a campaign', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} })
    const input = {
      email: 'test@example.com',
      subject: 'Prueba',
      body: 'Hola',
      template_key: 'brasper_brasil_es_v1' as const
    }
    await new MarketingApiAdapter().testDirect(input)
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(apiClient.post).toHaveBeenCalledWith(Domain.apiPath('marketing/test'), input)
  })
})
