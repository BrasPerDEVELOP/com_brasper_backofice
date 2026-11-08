export interface OmieRecord {
  status: string
  total: string
  os_id: number | null
  nfse_number: string | null
  error: string | null
}
export interface OmiePreview {
  can_issue: boolean
  record: OmieRecord | null
  total: string
  currency: string
  customer: string
  document: string
  issuer: string
  service: string
  account: string
}
