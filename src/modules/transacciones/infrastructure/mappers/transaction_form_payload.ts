import { normalizeAttachmentValues } from './parse_transaction'

function appendFileToForm(form: FormData, key: string, file: File): void {
  const name = file.name?.trim() || 'upload'
  form.append(key, file, name)
}

export function appendAttachmentValues(form: FormData, key: string, value: unknown): void {
  const values = normalizeAttachmentValues(value)
  for (const item of values) {
    if (item instanceof File) {
      appendFileToForm(form, key, item)
      continue
    }
    form.append(key, item)
  }
}

export function appendFormValue(form: FormData, key: string, value: unknown): void {
  if (value === undefined) return
  if (['send_voucher', 'payment_voucher', 'checked_image'].includes(key)) {
    appendAttachmentValues(form, key, value)
    return
  }

  // `null` significa "limpiar el campo": el backend interpreta cadena vacía como None.
  // (String(null) enviaría el literal "null" y corrompería campos de texto.)
  if (value === null) {
    form.append(key, '')
    return
  }
  if (value instanceof File) {
    appendFileToForm(form, key, value)
    return
  }
  if (key === 'destinations' && Array.isArray(value)) {
    form.append(key, JSON.stringify(value))
    return
  }
  // Listas de conservación de comprobantes (borrado individual): JSON para form-data.
  if (key.endsWith('_keep') && Array.isArray(value)) {
    form.append(key, JSON.stringify(value))
    return
  }
  if (typeof value === 'boolean') {
    form.append(key, value ? 'true' : 'false')
    return
  }
  if (typeof value === 'number') {
    form.append(key, String(value))
    return
  }
  if (typeof value === 'string') {
    form.append(key, value)
    return
  }
  form.append(key, String(value))
}
