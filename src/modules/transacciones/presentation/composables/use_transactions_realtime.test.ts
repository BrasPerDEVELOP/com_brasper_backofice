import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { matchesCurrentFilters } from './use_transactions_realtime'
import type { Transaction } from '../../domain/models'

describe('matchesCurrentFilters', () => {
  const baseTx: Transaction = {
    id: 'tx_1',
    transaction_code: 'TRS-100',
    status: 'pending',
    client: { id: 'usr_5', full_name: 'Ana Lopez' },
    send_date: '2026-08-17T12:00:00Z',
    created_at: '2026-08-17T10:00:00Z'
  }

  it('retorna true si no hay filtros definidos', () => {
    expect(matchesCurrentFilters(baseTx, undefined)).toBe(true)
    expect(matchesCurrentFilters(baseTx, {})).toBe(true)
  })

  it('valida filtro de estado correctamente', () => {
    expect(matchesCurrentFilters(baseTx, { status: 'pending' })).toBe(true)
    expect(matchesCurrentFilters(baseTx, { status: 'completed' })).toBe(false)
    expect(matchesCurrentFilters(baseTx, { status: 'todos' })).toBe(true)
  })

  it('valida filtro de usuario/cliente', () => {
    expect(matchesCurrentFilters(baseTx, { user_id: 'usr_5' })).toBe(true)
    expect(matchesCurrentFilters(baseTx, { user_id: 'usr_9' })).toBe(false)
  })

  it('valida filtro de búsqueda por texto', () => {
    expect(matchesCurrentFilters(baseTx, { search: 'TRS-100' })).toBe(true)
    expect(matchesCurrentFilters(baseTx, { search: 'Ana' })).toBe(true)
    expect(matchesCurrentFilters(baseTx, { search: 'Inexistente' })).toBe(false)
  })
})
