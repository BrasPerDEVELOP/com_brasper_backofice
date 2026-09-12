import { describe, it, expect } from 'vitest'
import { mentionQuery, activeMentionIds } from './mentions'
describe('menciones', () => {
  it('detecta @ al inicio o después de espacio, no en emails', () => {
    expect(mentionQuery('Hola @Ana', 9)).toEqual({ start: 5, query: 'ana' })
    expect(mentionQuery('ana@mail', 8)).toBeNull()
  })
  it('no notifica menciones eliminadas y evita duplicados', () => {
    const ana = { id: '1', name: 'Ana Pérez', role: 'sales' }
    expect(activeMentionIds('Hola @Ana Pérez', [ana, ana])).toEqual(['1'])
    expect(activeMentionIds('Hola', [ana])).toEqual([])
  })
})
