import { defineStore } from 'pinia'
import type { BankAccount } from '../../domain/models'
import type { CreateBankAccountPayload } from '../../infrastructure/adapters/cuentas_bancarias_repository'
import type { BankOption } from '../../infrastructure/adapters/banks_api_adapter'
import { GetBankAccountsUseCase } from '../../application/use_cases'
import { CuentasBancariasApiAdapter } from '../../infrastructure/adapters'
import { fetchBankNames } from '../../infrastructure/adapters/banks_api_adapter'
import {
  fetchClientUsers,
  fetchUsersForTransactionForm
} from '../../infrastructure/adapters/users_api_adapter'
import type { UserOption } from '../../infrastructure/adapters/users_api_adapter'
import { fetchUsers } from '@modules/auth/infrastructure/adapters/users_management_api_adapter'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'

interface CuentasBancariasState {
  bankAccounts: BankAccount[]
  /** Cuentas del cliente seleccionado en el formulario de transacciones (no sustituye `bankAccounts`). */
  transactionFormBankAccounts: BankAccount[]
  banks: BankOption[]
  clientUsers: UserOption[]
  /** Cliente + comercial + admin (selector transacciones / etiquetas). */
  transactionFormUsers: UserOption[]
  isLoading: boolean
  error: string | null
  isCreating: boolean
  _clientUsersLoaded: boolean
  _transactionFormUsersLoaded: boolean
  _banksLoaded: boolean
}

function getRepository() {
  return new CuentasBancariasApiAdapter()
}

function mergeUserOption(list: UserOption[], user: UserOption): UserOption[] {
  if (list.some((item) => item.id === user.id)) return list
  return [...list, user].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export const useCuentasBancariasStore = defineStore('cuentasBancarias', {
  state: (): CuentasBancariasState => ({
    bankAccounts: [],
    transactionFormBankAccounts: [],
    banks: [],
    clientUsers: [],
    transactionFormUsers: [],
    isLoading: false,
    error: null,
    isCreating: false,
    _clientUsersLoaded: false,
    _transactionFormUsersLoaded: false,
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

    async loadBankAccountsForTransactionUser(userId?: string) {
      const id = userId?.trim()
      if (!id) {
        this.transactionFormBankAccounts = []
        return
      }
      try {
        const repo = getRepository()
        const useCase = new GetBankAccountsUseCase(repo)
        this.transactionFormBankAccounts = await useCase.execute({ userId: id })
      } catch (e) {
        console.warn('Error al cargar cuentas del cliente (transacción):', e)
        this.transactionFormBankAccounts = []
      }
    },

    async loadBanks(force = false) {
      if (this._banksLoaded && !force) return
      try {
        this.banks = await fetchBankNames(force ? { bypassCache: true } : undefined)
        this._banksLoaded = true
      } catch (e) {
        console.warn('Error al cargar bancos:', e)
        if (!this._banksLoaded) this.banks = []
      }
    },

    upsertBankInCatalog(bank: BankOption) {
      const next = this.banks.filter((b) => b.id !== bank.id)
      next.push(bank)
      next.sort((a, b) => a.bank.localeCompare(b.bank, 'es'))
      this.banks = next
      this._banksLoaded = true
    },

    removeBankFromCatalog(id: string) {
      const norm = String(id).trim()
      if (!norm) return
      this.banks = this.banks.filter((b) => String(b.id).trim() !== norm)
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

    async loadTransactionFormUsers(force = false) {
      if (this._transactionFormUsersLoaded && !force) return
      try {
        this.transactionFormUsers = await fetchUsersForTransactionForm()
        this._transactionFormUsersLoaded = true
      } catch (e) {
        console.warn('Error al cargar usuarios (transacciones):', e)
        this.transactionFormUsers = []
      }
    },

    async ensureTransactionFormUser(userId?: string | null) {
      const id = userId?.trim()
      if (!id) return null

      const existing =
        this.transactionFormUsers.find((u) => u.id === id) ??
        this.clientUsers.find((u) => u.id === id)
      if (existing) return existing

      try {
        const users = await fetchUsers({ user_id: id })
        const user = users[0]
        if (!user) return null

        const option: UserOption = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }

        this.transactionFormUsers = mergeUserOption(this.transactionFormUsers, option)
        this.clientUsers = mergeUserOption(this.clientUsers, option)
        return option
      } catch (e) {
        console.warn('Error al asegurar usuario de transacción:', e)
        return null
      }
    },

    async createBankAccount(
      payload: Omit<CreateBankAccountPayload, 'user_id'> & { user_id?: string }
    ): Promise<BankAccount> {
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
        const created = await repo.createBankAccount(fullPayload)
        await this.loadBankAccounts()
        await this.loadBankAccountsForTransactionUser(userId)
        return created
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al crear cuenta bancaria'
        throw e
      } finally {
        this.isCreating = false
      }
    }
  }
})
