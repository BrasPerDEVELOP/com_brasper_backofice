import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/interface/api/client'
import { createBank, deleteBank, updateBank } from './banks_api_adapter'

vi.mock('@/interface/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

describe('banks api adapter (cuentas Brasper)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea una cuenta corporativa omitiendo campos opcionales vacíos', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { id: 'b1', bank: 'BCP', company: 'Brasper 21 SAC', currency: 'PEN', country: 'pe' }
    })
    await createBank({
      bank: 'BCP',
      company: 'Brasper 21 SAC',
      currency: 'PEN',
      country: 'pe',
      account: null,
      pix: null
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      'transactions/banks',
      expect.objectContaining({ bank: 'BCP', company: 'Brasper 21 SAC' })
    )
    expect(vi.mocked(apiClient.post).mock.calls[0]?.[1]).not.toHaveProperty('account')
  })

  it('actualiza enviando el identificador en el body', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { id: 'b1', bank: 'Interbank', currency: 'PEN', country: 'pe' }
    })
    await updateBank('b1', { bank: 'Interbank' })
    expect(apiClient.put).toHaveBeenCalledWith(
      'transactions/banks',
      expect.objectContaining({ id: 'b1', bank: 'Interbank' })
    )
  })

  it('elimina usando el endpoint de detalle', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ status: 204 })
    await deleteBank('b1')
    expect(apiClient.delete).toHaveBeenCalledWith('transactions/banks/b1')
  })
})
