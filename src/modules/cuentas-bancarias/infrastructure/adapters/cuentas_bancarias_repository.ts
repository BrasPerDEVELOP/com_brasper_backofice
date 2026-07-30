import type { BankAccount } from '../../domain/models'

export interface CreateBankAccountPayload {
  user_id: string
  bank_id: string
  account_flow: 'origin' | 'destination'
  account_holder_type: 'naturalPerson' | 'legalEntity' | 'generalAspect'
  bank_country: 'pe' | 'br'
  holder_names?: string | null
  holder_surnames?: string | null
  document_number?: string | null
  business_name?: string | null
  ruc_number?: string | null
  legal_representative_name?: string | null
  legal_representative_document?: string | null
  account_number?: string | null
  account_number_confirmation?: string | null
  cci_number?: string | null
  cci_number_confirmation?: string | null
  pix_key?: string | null
  pix_key_confirmation?: string | null
  pix_key_type?: string | null
  cpf?: string | null
}

/** El backend recibe el `id` en el body (PUT transactions/bank-accounts/). */
export interface UpdateBankAccountPayload extends Partial<CreateBankAccountPayload> {
  id: string
}

export interface GetBankAccountsParams {
  userId?: string
  bank_country?: 'pe' | 'br'
  account_flow?: 'origin' | 'destination'
}

export interface CuentasBancariasRepository {
  getBankAccounts(params?: GetBankAccountsParams): Promise<BankAccount[]>
  createBankAccount(payload: CreateBankAccountPayload): Promise<BankAccount>
  updateBankAccount(payload: UpdateBankAccountPayload): Promise<BankAccount>
  deleteBankAccount(id: string): Promise<void>
}
