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

  if (value instanceof File) {
    appendFileToForm(form, key, value)
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
