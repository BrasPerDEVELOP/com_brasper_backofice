/** Preserve CPF as a string: leading zeros are part of the document. */
export function normalizeUserDocument(type: string, value: string): string {
  return type.toLowerCase() === 'cpf' ? value.replace(/[.\s-]/g, '') : value.replace(/\s+/g, '')
}

export function displayUserDocument(type: string, value: string): string {
  if (type.toLowerCase() !== 'cpf') return value
  const digits = normalizeUserDocument(type, value)
  if (!/^\d{0,11}$/.test(digits)) return value
  return digits.replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2')
}
