// Lógica pura del asistente de creación de cuenta bancaria.
// Separada del componente para poder probarla sin DOM (vitest environment: node).

export type WizardCountry = 'pe' | 'br'
export type WizardFlow = 'origin' | 'destination'
export type WizardHolder = 'natural' | 'juridica'
export type WizardVariant = 'accounts' | 'transaction'

export interface WizardStep2Form {
  bank_id: string
  bank_country: WizardCountry
  holder_type: WizardHolder
  holder_names: string
  holder_surnames: string
  document_number: string
  business_name: string
  ruc_number: string
  account_number: string
  account_number_confirmation: string
  cci_number: string
  cci_number_confirmation: string
  pix_key: string
  pix_key_confirmation: string
  pix_key_type: string
  cpf: string
}

export const CCI_LENGTH = 20
export const DNI_LENGTH = 8
export const CPF_LENGTH = 11
export const RUC_LENGTH = 11
export const CNPJ_LENGTH = 14

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Longitud máxima del documento de la persona jurídica según país (RUC 11 / CNPJ 14). */
export function legalEntityDocumentLength(country: WizardCountry): number {
  return country === 'pe' ? RUC_LENGTH : CNPJ_LENGTH
}

/**
 * Valida el paso 2 (datos de la cuenta) y devuelve errores por campo.
 * En `variant: 'accounts'` el identificador del país es obligatorio
 * (N° de cuenta en PE, clave PIX en BR); en `transaction` se mantiene laxo.
 */
export function validateWizardStep2(
  form: WizardStep2Form,
  variant: WizardVariant
): Record<string, string> {
  const errors: Record<string, string> = {}
  const requiresIdentifier = variant === 'accounts'

  if (!form.bank_id) errors.bank_id = 'Selecciona un banco.'

  if (form.bank_country === 'pe') {
    if (requiresIdentifier && !form.account_number) {
      errors.account_number = 'El número de cuenta es obligatorio.'
    }
    if (form.account_number && form.account_number !== form.account_number_confirmation) {
      errors.account_number_confirmation = 'La confirmación no coincide.'
    }
    if (form.cci_number && digitsOnly(form.cci_number).length !== CCI_LENGTH) {
      errors.cci_number = `El CCI debe tener ${CCI_LENGTH} dígitos.`
    }
    if (form.cci_number && form.cci_number !== form.cci_number_confirmation) {
      errors.cci_number_confirmation = 'La confirmación no coincide.'
    }
    if (
      form.holder_type === 'natural' &&
      form.document_number &&
      digitsOnly(form.document_number).length !== DNI_LENGTH
    ) {
      errors.document_number = `El DNI debe tener ${DNI_LENGTH} dígitos.`
    }
  } else {
    if (requiresIdentifier && !form.pix_key.trim()) {
      errors.pix_key = 'La clave PIX es obligatoria.'
    }
    if ((requiresIdentifier || form.pix_key.trim()) && !form.pix_key_type) {
      errors.pix_key_type = 'Selecciona el tipo de clave PIX.'
    }
    if (form.pix_key && form.pix_key !== form.pix_key_confirmation) {
      errors.pix_key_confirmation = 'La confirmación no coincide.'
    }
    if (form.cpf && digitsOnly(form.cpf).length !== CPF_LENGTH) {
      errors.cpf = `El CPF debe tener ${CPF_LENGTH} dígitos.`
    }
  }

  if (form.holder_type === 'juridica' && form.ruc_number) {
    const expected = legalEntityDocumentLength(form.bank_country)
    if (digitsOnly(form.ruc_number).length !== expected) {
      errors.ruc_number =
        form.bank_country === 'pe'
          ? `El RUC debe tener ${RUC_LENGTH} dígitos.`
          : `El CNPJ debe tener ${CNPJ_LENGTH} dígitos.`
    }
  }

  return errors
}

/** Un banco solo es válido para el país seleccionado; sin país en el catálogo se acepta. */
export function bankMatchesCountry(
  bankCountry: string | undefined,
  selectedCountry: WizardCountry
): boolean {
  return !bankCountry || bankCountry.toLowerCase() === selectedCountry
}
