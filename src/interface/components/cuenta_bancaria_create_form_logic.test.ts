import { describe, expect, it } from 'vitest'
import {
  bankMatchesCountry,
  digitsOnly,
  legalEntityDocumentLength,
  validateWizardStep2,
  type WizardStep2Form
} from './cuenta_bancaria_create_form_logic'

function baseForm(overrides: Partial<WizardStep2Form> = {}): WizardStep2Form {
  return {
    bank_id: 'bank-1',
    bank_country: 'pe',
    holder_type: 'natural',
    holder_names: 'Juan',
    holder_surnames: 'Pérez',
    document_number: '',
    business_name: '',
    ruc_number: '',
    account_number: '',
    account_number_confirmation: '',
    cci_number: '',
    cci_number_confirmation: '',
    pix_key: '',
    pix_key_confirmation: '',
    pix_key_type: '',
    cpf: '',
    ...overrides
  }
}

describe('validateWizardStep2 — identificador obligatorio por variante', () => {
  it('accounts exige número de cuenta en PE', () => {
    const errors = validateWizardStep2(baseForm(), 'accounts')
    expect(errors.account_number).toBeTruthy()
  })

  it('transaction no exige número de cuenta en PE', () => {
    const errors = validateWizardStep2(baseForm(), 'transaction')
    expect(errors.account_number).toBeUndefined()
  })

  it('accounts exige clave PIX y su tipo en BR', () => {
    const errors = validateWizardStep2(baseForm({ bank_country: 'br' }), 'accounts')
    expect(errors.pix_key).toBeTruthy()
    expect(errors.pix_key_type).toBeTruthy()
  })

  it('transaction no exige PIX, pero si hay clave exige el tipo', () => {
    const sinPix = validateWizardStep2(baseForm({ bank_country: 'br' }), 'transaction')
    expect(sinPix.pix_key).toBeUndefined()
    expect(sinPix.pix_key_type).toBeUndefined()

    const conPix = validateWizardStep2(
      baseForm({ bank_country: 'br', pix_key: 'a@b.com', pix_key_confirmation: 'a@b.com' }),
      'transaction'
    )
    expect(conPix.pix_key_type).toBeTruthy()
  })
})

describe('validateWizardStep2 — longitudes por documento', () => {
  it('acepta RUC de 11 dígitos en PE y rechaza 14', () => {
    const ok = validateWizardStep2(
      baseForm({ holder_type: 'juridica', ruc_number: '12345678901', account_number: '1', account_number_confirmation: '1' }),
      'accounts'
    )
    expect(ok.ruc_number).toBeUndefined()

    const mal = validateWizardStep2(
      baseForm({ holder_type: 'juridica', ruc_number: '12345678901234', account_number: '1', account_number_confirmation: '1' }),
      'accounts'
    )
    expect(mal.ruc_number).toContain('RUC')
  })

  it('acepta CNPJ de 14 dígitos en BR y rechaza 11 (regresión: CNPJ bloqueado)', () => {
    const ok = validateWizardStep2(
      baseForm({
        bank_country: 'br',
        holder_type: 'juridica',
        ruc_number: '12345678901234',
        pix_key: 'a@b.com',
        pix_key_confirmation: 'a@b.com',
        pix_key_type: 'email'
      }),
      'accounts'
    )
    expect(ok.ruc_number).toBeUndefined()

    const mal = validateWizardStep2(
      baseForm({ bank_country: 'br', holder_type: 'juridica', ruc_number: '12345678901' }),
      'accounts'
    )
    expect(mal.ruc_number).toContain('CNPJ')
  })

  it('valida DNI de 8, CPF de 11 y CCI de 20', () => {
    const errors = validateWizardStep2(
      baseForm({
        document_number: '123',
        account_number: '1',
        account_number_confirmation: '1',
        cci_number: '123'
      }),
      'accounts'
    )
    expect(errors.document_number).toBeTruthy()
    expect(errors.cci_number).toBeTruthy()

    const br = validateWizardStep2(
      baseForm({ bank_country: 'br', cpf: '123', pix_key: 'x', pix_key_confirmation: 'x', pix_key_type: 'cpf' }),
      'accounts'
    )
    expect(br.cpf).toBeTruthy()
  })
})

describe('validateWizardStep2 — confirmaciones y banco', () => {
  it('rechaza confirmaciones que no coinciden', () => {
    const errors = validateWizardStep2(
      baseForm({
        account_number: '111',
        account_number_confirmation: '222',
        cci_number: '11111111111111111111',
        cci_number_confirmation: '9'
      }),
      'accounts'
    )
    expect(errors.account_number_confirmation).toBeTruthy()
    expect(errors.cci_number_confirmation).toBeTruthy()

    const br = validateWizardStep2(
      baseForm({ bank_country: 'br', pix_key: 'a', pix_key_confirmation: 'b', pix_key_type: 'email' }),
      'accounts'
    )
    expect(br.pix_key_confirmation).toBeTruthy()
  })

  it('exige banco seleccionado', () => {
    const errors = validateWizardStep2(baseForm({ bank_id: '' }), 'transaction')
    expect(errors.bank_id).toBeTruthy()
  })
})

describe('helpers', () => {
  it('bankMatchesCountry filtra por país y tolera catálogo sin país (regresión: banco de otro país)', () => {
    expect(bankMatchesCountry('pe', 'pe')).toBe(true)
    expect(bankMatchesCountry('PE', 'pe')).toBe(true)
    expect(bankMatchesCountry('br', 'pe')).toBe(false)
    expect(bankMatchesCountry(undefined, 'pe')).toBe(true)
  })

  it('digitsOnly elimina todo lo que no sea dígito', () => {
    expect(digitsOnly('12a b-3.4')).toBe('1234')
  })

  it('legalEntityDocumentLength devuelve 11 para PE y 14 para BR', () => {
    expect(legalEntityDocumentLength('pe')).toBe(11)
    expect(legalEntityDocumentLength('br')).toBe(14)
  })
})
