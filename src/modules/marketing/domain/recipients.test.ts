import { describe, expect, it } from 'vitest'
import { parseRecipients } from './recipients'

describe('Marketing recipients', () => {
  it('deduplicates emails across line, comma and semicolon separators', () => {
    expect(parseRecipients('A@example.com; b@example.com\na@example.com, c@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com'
    ])
  })
  it('keeps malformed entries visible for validation instead of silently dropping them', () => {
    expect(parseRecipients('invalid; valid@example.com')).toEqual(['invalid', 'valid@example.com'])
  })
})
