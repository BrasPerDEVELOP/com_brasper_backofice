import axios from 'axios'
import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'

export interface DocumentLookupResult {
  document_type: string
  document_number: string
  names: string
  lastnames: string
  source: 'apiperu' | 'cpfcnpj'
}

export async function lookupDocument(documentType: string, documentNumber: string): Promise<DocumentLookupResult> {
  try {
    const { data } = await apiClient.post<DocumentLookupResult>(Domain.apiPath('user/document-lookup'), {
      document_type: documentType,
      document_number: documentNumber,
    }, { timeout: 25000 })
    return data
  } catch (error) {
    const detail: unknown = axios.isAxiosError(error) ? error.response?.data?.detail : null
    throw new Error(typeof detail === 'string' ? detail : 'No se pudo consultar el documento. Revisa el número o completa los datos manualmente.')
  }
}
