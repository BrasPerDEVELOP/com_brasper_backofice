import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { ALL_COUNTRIES, UNKNOWN_COUNTRY, useUserCountryOptions } from './use_user_country_filter'

describe('filtro de país de usuarios', () => {
  it('construye las opciones únicamente con los países devueltos por el backend', () => {
    const countries = ref([' Brasil ', 'Perú', 'PERU'])
    const { options } = useUserCountryOptions(countries)
    expect(options.value.map((o) => o.value)).toEqual([
      ALL_COUNTRIES,
      'brasil',
      'peru',
      UNKNOWN_COUNTRY
    ])
    countries.value = []
    expect(options.value.map((o) => o.value)).toEqual([ALL_COUNTRIES, UNKNOWN_COUNTRY])
  })
})
