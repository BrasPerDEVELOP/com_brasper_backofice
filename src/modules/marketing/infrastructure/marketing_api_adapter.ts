import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  Campaign,
  DispatchInput,
  DirectTestInput,
  MarketingRepository,
  Recipient,
  EmailTemplate,
  EmailPreviewInput
} from '../domain/models'

const endpoint = (path: string) => Domain.apiPath(`marketing/${path}`)
export class MarketingApiAdapter implements MarketingRepository {
  async templates() {
    return (await apiClient.get<{ items: EmailTemplate[] }>(endpoint('templates'))).data.items
  }
  async preview(input: EmailPreviewInput) {
    return (await apiClient.post<{ html: string }>(endpoint('preview'), input)).data.html
  }
  async list(skip = 0) {
    return (
      await apiClient.get<{ items: Campaign[]; total: number }>(endpoint('campaigns'), {
        params: { skip, limit: 30 }
      })
    ).data
  }
  async dispatch(input: DispatchInput) {
    return (await apiClient.post<Campaign>(endpoint('dispatch'), input)).data
  }
  async testDirect(input: DirectTestInput) {
    await apiClient.post(endpoint('test'), input)
  }
  async send(id: string) {
    return (await apiClient.post<Campaign>(endpoint(`campaigns/${id}/send`))).data
  }
  async test(id: string, email: string) {
    await apiClient.post(endpoint(`campaigns/${id}/test`), { email })
  }
  async recipients(id: string, skip = 0) {
    return (
      await apiClient.get<{ items: Recipient[] }>(endpoint(`campaigns/${id}/recipients`), {
        params: { skip, limit: 100 }
      })
    ).data.items
  }
  async clients(q: string, skip = 0) {
    return (
      await apiClient.get<{ items: string[] }>(endpoint('clients'), {
        params: { q, skip, limit: 100 }
      })
    ).data.items
  }
  async configuration() {
    return (await apiClient.get<{ from_email: string; ready: boolean }>(endpoint('configuration')))
      .data
  }
}
