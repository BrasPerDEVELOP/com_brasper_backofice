export interface BankAccount {
  id: string
  user_id: string
  bank_id: string
  account_flow: string
  account_holder_type: string
  bank_country: string
  holder_names: string | null
  holder_surnames: string | null
  document_number: string | null
  business_name: string | null
  ruc_number: string | null
  legal_representative_name: string | null
  legal_representative_document: string | null
  account_number: string | null
  account_number_confirmation: string | null
  cci_number: string | null
  cci_number_confirmation: string | null
  pix_key: string | null
  pix_key_confirmation: string | null
  pix_key_type: string | null
  cpf: string | null
  created_at: string | undefined
  created_by: string | null
  updated_at: string | undefined
}
