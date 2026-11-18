export interface OmieRecord {
  status: string
  total: string
  issued_at?: string | null
  os_id: number | null
  nfse_number: string | null
  error: string | null
}

export interface OmieEmailDetails {
  customer_emails: string[]
  email_status: 'pending' | 'sending' | 'sent' | 'failed' | null
  email_error: string | null
  email_recipients: string[]
  email_delivered_to: string[]
  email_sent_at: string | null
}

export interface OmieInvoiceListItem extends OmieRecord {
  description?: string
  transaction_id: string
  transaction_code: string
  currency: 'BRL'
  customer: string
  document: string
  issuer: string
  service: string
  created_at: string
}

export interface OmieInvoiceList {
  items: OmieInvoiceListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface OmieInvoiceFilters {
  page: number
  pageSize: number
  status?: string
  dateFrom?: string
  dateTo?: string
}
export interface OmiePreview {
  description?: string
  can_issue: boolean
  customer_registration_required?: boolean
  record: OmieRecord | null
  total: string
  currency: string
  customer: string
  document: string
  email?: string
  issuer: string
  service: string
  account: string
}

export interface OmieCustomerRegistration {
  legal_name: string
  email: string
  street: string
  number: string
  district: string
  city: string
  state: string
  postal_code: string
  phone_area_code: string
  phone_number: string
}
