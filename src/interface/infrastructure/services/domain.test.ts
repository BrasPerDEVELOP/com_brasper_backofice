import { describe, expect, it } from 'vitest'

import { Domain } from './domain'

describe('Domain.apiPath', () => {
  it.each([
    ['auth/login', 'auth/login'],
    ['/auth/login/', 'auth/login'],
    ['///transactions/coupons///', 'transactions/coupons'],
    ['/transactions/?page=2', 'transactions?page=2'],
    ['/blog/#latest', 'blog#latest'],
    ['/', ''],
  ])('normaliza %s como %s', (input, expected) => {
    expect(Domain.apiPath(input)).toBe(expected)
  })
})
