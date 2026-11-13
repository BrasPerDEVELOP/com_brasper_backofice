export interface OmieRecord {
  status: string
  total: string
  os_id: number | null
  nfse_number: string | null
  error: string | null
}
export interface OmiePreview {
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
