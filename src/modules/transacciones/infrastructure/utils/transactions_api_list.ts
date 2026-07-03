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

/**
 * Extrae el total de una respuesta paginada. Si el API no lo provee
 * (respuesta como arreglo plano o sin `total`), retorna `fallback`
 * (normalmente el número de ítems de la página).
 */
export function extractTotalFromApiPayload(raw: unknown, fallback = 0): number {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const total = obj.total
    if (typeof total === 'number' && Number.isFinite(total) && total >= 0) {
      return total
    }
  }
  return fallback
}
