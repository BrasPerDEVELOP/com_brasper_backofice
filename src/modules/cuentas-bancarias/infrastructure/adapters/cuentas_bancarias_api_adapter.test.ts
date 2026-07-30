import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/interface/api/client'
import { CuentasBancariasApiAdapter } from './cuentas_bancarias_api_adapter'

vi.mock('@/interface/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
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
      data: { id: 'a1', user_id: 'u1', bank_id: 'b2', account_number: '001102320201062626' }
    })
    const updated = await new CuentasBancariasApiAdapter().updateBankAccount({
      id: 'a1',
      bank_id: 'b2',
      account_number: '001102320201062626'
    })
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/transactions/bank-accounts/',
      expect.objectContaining({ id: 'a1', bank_id: 'b2', account_number: '001102320201062626' })
    )
    expect(updated.id).toBe('a1')
    expect(updated.account_number).toBe('001102320201062626')
  })

  it('preserva el CCI como texto exacto al crear', async () => {
    const cci = '01123200020106262661'
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { id: 'a1', user_id: 'u1', bank_id: 'b1', cci_number: cci }
    })
    await new CuentasBancariasApiAdapter().createBankAccount({
      user_id: 'u1',
      bank_id: 'b1',
      account_flow: 'destination',
      account_holder_type: 'naturalPerson',
      bank_country: 'pe',
      cci_number: cci,
      cci_number_confirmation: cci
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/transactions/bank-accounts/',
      expect.objectContaining({ cci_number: cci, cci_number_confirmation: cci })
    )
  })

  it('elimina por el endpoint de detalle', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: null })
    await new CuentasBancariasApiAdapter().deleteBankAccount('a1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/transactions/bank-accounts/a1')
  })
})
