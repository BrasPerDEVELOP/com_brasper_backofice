import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { OmieCustomerRegistration, OmieInvoiceFilters, OmieInvoiceList, OmiePreview, OmieRecord } from '../domain/models'

export const omieApi = {
  async records(ids: string[]): Promise<Record<string, OmieRecord>> {
    return (await apiClient.get(Domain.apiPath('omie/transaction-records'), {
      params: { transaction_ids: ids }, paramsSerializer: { indexes: null }
    })).data
  },
  async listInvoices(filters: OmieInvoiceFilters): Promise<OmieInvoiceList> {
    return (await apiClient.get(Domain.apiPath('omie/invoices'), {
      params: {
        page: filters.page,
        page_size: filters.pageSize,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
        ...(filters.dateTo ? { date_to: filters.dateTo } : {})
      }
    })).data
  },
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
