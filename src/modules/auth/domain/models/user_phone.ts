/** Conserva usuarios con @ y ceros iniciales; admite respuestas numéricas antiguas. */
export function normalizeUserPhone(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

export function normalizeWhatsAppUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const username = value.trim().replace(/^@+/, '').trim()
  return username ? `@${username}` : null
}

/** Read legacy @handles while keeping the two contact fields independent. */
export function parseUserContacts(data: Record<string, unknown>) {
  const rawPhone = normalizeUserPhone(data.phone ?? data.telefono)
  const legacyUsername = rawPhone?.startsWith('@') ? rawPhone : null
  return {
    phone: legacyUsername ? null : rawPhone,
    // Explicit null means the username was removed; do not resurrect it.
    whatsapp_username: 'whatsapp_username' in data
      ? normalizeWhatsAppUsername(data.whatsapp_username)
      : legacyUsername,
  }
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
