import { defineStore } from 'pinia'
import type { BankAccount } from '../../domain/models'
import type { CreateBankAccountPayload } from '../../infrastructure/adapters/cuentas_bancarias_repository'
import type { BankOption } from '../../infrastructure/adapters/banks_api_adapter'
import { GetBankAccountsUseCase } from '../../application/use_cases'
import { CuentasBancariasApiAdapter } from '../../infrastructure/adapters'
import { fetchBankNames } from '../../infrastructure/adapters/banks_api_adapter'
import { fetchClientUsers } from '../../infrastructure/adapters/users_api_adapter'
import type { UserOption } from '../../infrastructure/adapters/users_api_adapter'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'

interface CuentasBancariasState {
  bankAccounts: BankAccount[]
  banks: BankOption[]
  clientUsers: UserOption[]
  isLoading: boolean
  error: string | null
  isCreating: boolean
  _clientUsersLoaded: boolean
  _banksLoaded: boolean
}

function getRepository() {
  return new CuentasBancariasApiAdapter()
}

export const useCuentasBancariasStore = defineStore('cuentasBancarias', {
  state: (): CuentasBancariasState => ({
    bankAccounts: [],
    banks: [],
    clientUsers: [],
    isLoading: false,
    error: null,
    isCreating: false,
    _clientUsersLoaded: false,
    _banksLoaded: false
  }),

  actions: {
    async loadBankAccounts(params?: { userId?: string; bank_country?: 'pe' | 'br'; account_flow?: 'origin' | 'destination' }) {
      this.isLoading = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetBankAccountsUseCase(repo)
        this.bankAccounts = await useCase.execute(params)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar cuentas bancarias'
      } finally {
        this.isLoading = false
      }
    },

    async loadBanks(force = false) {
      if (this._banksLoaded && !force) return
      try {
        this.banks = await fetchBankNames()
        this._banksLoaded = true
      } catch (e) {
        console.warn('Error al cargar bancos:', e)
        this.banks = []
      }
    },

    async loadClientUsers(force = false) {
      if (this._clientUsersLoaded && !force) return
      try {
        this.clientUsers = await fetchClientUsers()
        this._clientUsersLoaded = true
      } catch (e) {
        console.warn('Error al cargar usuarios cliente:', e)
        this.clientUsers = []
      }
    },

    async createBankAccount(payload: Omit<CreateBankAccountPayload, 'user_id'> & { user_id?: string }) {
      this.isCreating = true
      this.error = null
      try {
        const authStore = useAuthStore()
        const userId = payload.user_id ?? authStore.user?.id
        if (!userId) throw new Error('Usuario no autenticado')
        const { user_id: _omit, ...rest } = payload
        const fullPayload: CreateBankAccountPayload = {
          ...rest,
          user_id: userId
        }
        const repo = getRepository()
        await repo.createBankAccount(fullPayload)
        await this.loadBankAccounts({ userId })
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al crear cuenta bancaria'
        throw e
      } finally {
        this.isCreating = false
      }
    }
  }
})
