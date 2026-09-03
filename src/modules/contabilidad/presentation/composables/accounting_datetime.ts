function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** ISO o `YYYY-MM-DD` → valor `date` (`YYYY-MM-DD`) en hora local. */
export function apiDateTimeToFormValue(raw: string | undefined | null): string {
  if (!raw?.trim()) return ''
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return localDateKey(d)
}

/** `YYYY-MM-DD` → ISO UTC (medianoche local) para el PUT de `billing_date`. */
export function formDateTimeToApi(local: string): string | undefined {
  if (!local?.trim()) return undefined
  const date = local.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}
