import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/interface/api/client'
import { CuentasBancariasApiAdapter } from './cuentas_bancarias_api_adapter'

vi.mock('@/interface/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@/interface/infrastructure/services', () => ({ Domain: { apiPath: (path: string) => `/api/${path}` } }))

describe('CuentasBancariasApiAdapter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recorre respuestas paginadas para no omitir cuentas', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { results: [{ id: 'a1', user_id: 'u1' }], next: '/api/transactions/bank-accounts/?page=2' } })
      .mockResolvedValueOnce({ data: { results: [{ id: 'a2', user_id: 'u2' }], next: null } })
    const accounts = await new CuentasBancariasApiAdapter().getBankAccounts()
    expect(accounts.map((account) => account.id)).toEqual(['a1', 'a2'])
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })

  it('envía los filtros opcionales cuando existen', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })
    await new CuentasBancariasApiAdapter().getBankAccounts({ userId: 'u1', bank_country: 'pe', account_flow: 'destination' })
    expect(apiClient.get).toHaveBeenCalledWith('/api/transactions/bank-accounts/?user_id=u1&bank_country=pe&account_flow=destination')
  })

  it('actualiza con PUT enviando el id en el body y parsea la respuesta', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { id: 'a1', user_id: 'u1', bank_id: 'b2', account_number: 999 }
    })
    const updated = await new CuentasBancariasApiAdapter().updateBankAccount({
      id: 'a1',
      bank_id: 'b2',
      account_number: 999
    })
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/transactions/bank-accounts/',
      expect.objectContaining({ id: 'a1', bank_id: 'b2', account_number: 999 })
    )
    expect(updated.id).toBe('a1')
    expect(updated.account_number).toBe('999')
  })
})
