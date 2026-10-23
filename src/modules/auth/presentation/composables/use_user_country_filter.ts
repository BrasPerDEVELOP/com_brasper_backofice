import { computed, type Ref } from 'vue'

export const ALL_COUNTRIES = 'todos'
export const UNKNOWN_COUNTRY = 'sin-pais'

export function userCountryKey(country: string | null | undefined): string {
  return (
    country
      ?.trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() || UNKNOWN_COUNTRY
  )
}

/** Only formats country options returned by the backend; does not filter users. */
export function useUserCountryOptions(values: Ref<string[]>) {
  const options = computed(() => {
    const countries = new Map<string, string>()
    for (const country of values.value) {
      if (country.trim()) countries.set(userCountryKey(country), country.trim())
    }
    return [
      { value: ALL_COUNTRIES, label: 'Todos los países' },
      ...[...countries]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es')),
      { value: UNKNOWN_COUNTRY, label: 'Sin país registrado' }
    ]
  })
  return { options }
}
