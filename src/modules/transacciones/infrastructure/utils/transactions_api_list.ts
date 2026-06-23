/** Extrae la lista de transacciones de respuestas paginadas o anidadas del API. */
export function extractTransactionsListFromApiPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw == null || typeof raw !== 'object') return []

  const obj = raw as Record<string, unknown>
  const candidates = [
    obj.items,
    obj.data,
    obj.results,
    obj.transactions,
    obj.records,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
    if (candidate != null && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const nested = extractTransactionsListFromApiPayload(candidate)
      if (nested.length > 0) return nested
    }
  }

  return []
}
