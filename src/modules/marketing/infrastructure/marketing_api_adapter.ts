import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { Campaign, CampaignInput, MarketingRepository, Recipient } from '../domain/models'

const endpoint = (path: string) => Domain.apiPath(`marketing/${path}`)
export class MarketingApiAdapter implements MarketingRepository {
  async list(skip = 0) {
    return (
      await apiClient.get<{ items: Campaign[]; total: number }>(endpoint('campaigns'), {
        params: { skip, limit: 30 }
      })
    ).data
  }
  async create(input: CampaignInput) {
    return (await apiClient.post<Campaign>(endpoint('campaigns'), input)).data
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
