import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { OmieCustomerRegistration, OmiePreview, OmieRecord } from '../domain/models'

export const omieApi = {
  async preview(id: string): Promise<OmiePreview> {
    return (await apiClient.get(Domain.apiPath(`omie/transactions/${id}/preview`))).data
  },
  async registerCustomer(id: string, details: OmieCustomerRegistration): Promise<void> {
    await apiClient.post(Domain.apiPath(`omie/transactions/${id}/customer`), {
      ...details,
      state: details.state.toUpperCase(),
      postal_code: details.postal_code || null,
      phone_area_code: details.phone_area_code || null,
      phone_number: details.phone_number || null
    })
  },
  async issue(id: string, total: string, document: string): Promise<OmieRecord> {
    return (await apiClient.post(Domain.apiPath(`omie/transactions/${id}/issue`), {
      expected_total: total, expected_document: document
    })).data
  },
  async refresh(id: string): Promise<OmieRecord> {
    return (await apiClient.post(Domain.apiPath(`omie/transactions/${id}/refresh`))).data
  },
  async pdf(id: string): Promise<string> {
    return (await apiClient.get(Domain.apiPath(`omie/transactions/${id}/pdf`))).data.url
  }
}
