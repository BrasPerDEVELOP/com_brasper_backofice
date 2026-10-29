/** Conserva usuarios con @ y ceros iniciales; admite respuestas numéricas antiguas. */
export function normalizeUserPhone(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/** El código de país solo acompaña a números, nunca al nombre de usuario. */
export function formatUserPhone(
  phone: string | null | undefined,
  codePhone?: string | null
): string {
  const value = normalizeUserPhone(phone)
  if (!value) return ''
  if (/[^\d+\s().-]/.test(value)) return value
  return [codePhone?.trim(), value].filter(Boolean).join(' ')
}
