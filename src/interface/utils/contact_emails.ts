/** Preserve display spelling and order, removing blank and duplicate contacts. */
export function uniqueEmails(values: unknown[]): string[] {
  const seen = new Set<string>()
  return values.flatMap((value) => {
    if (typeof value !== 'string') return []
    const email = value.trim()
    if (!email || email === '-' || seen.has(email.toLowerCase())) return []
    seen.add(email.toLowerCase())
    return [email]
  })
}

export function contactEmails(raw: unknown, primary?: unknown): string[] {
  return uniqueEmails([primary, ...(Array.isArray(raw) ? raw : [])])
}

export function unsentEmails(recipients: string[], delivered: string[]): string[] {
  const sent = new Set(delivered.map((email) => email.toLowerCase()))
  return uniqueEmails(recipients).filter((email) => !sent.has(email.toLowerCase()))
}
