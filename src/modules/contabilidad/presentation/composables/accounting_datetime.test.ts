import { describe, expect, it } from 'vitest'
import { apiDateTimeToFormValue, formDateTimeToApi } from './accounting_datetime'

describe('accounting_datetime', () => {
  it('convierte ISO a fecha local y de vuelta a ISO de medianoche local', () => {
    const local = apiDateTimeToFormValue('2026-09-03T15:15:00.000Z')
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(formDateTimeToApi(local)).toBe(new Date(`${local}T00:00:00`).toISOString())
  })

  it('deja YYYY-MM-DD tal cual', () => {
    expect(apiDateTimeToFormValue('2026-09-02')).toBe('2026-09-02')
  })

  it('no arma ISO si el valor local está incompleto', () => {
    expect(formDateTimeToApi('2026-09')).toBeUndefined()
    expect(formDateTimeToApi('')).toBeUndefined()
  })
})
