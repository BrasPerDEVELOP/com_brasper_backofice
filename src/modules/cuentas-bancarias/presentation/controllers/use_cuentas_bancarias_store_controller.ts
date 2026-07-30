import { defineStore } from 'pinia'
import type { BankAccount } from '../../domain/models'
import type {
  CreateBankAccountPayload,
  UpdateBankAccountPayload
} from '../../infrastructure/adapters/cuentas_bancarias_repository'
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
  /** Caché por usuario para el workspace unificado; evita recargar al volver a una ficha. */
  bankAccountsByUser: Record<string, BankAccount[]>
  /** Cuentas del cliente seleccionado en el formulario de transacciones (no sustituye `bankAccounts`). */
  transactionFormBankAccounts: BankAccount[]
  /** `user_id` al que pertenecen `transactionFormBankAccounts` (evita mezclar clientes al cambiar). */
  transactionFormBankAccountsUserId: string | null
  transactionFormBankAccountsLoading: boolean
  _transactionFormBankAccountsLoadSeq: number
  banks: BankOption[]
  clientUsers: UserOption[]
  /** Cliente + comercial + admin (selector transacciones / etiquetas). */
  transactionFormUsers: UserOption[]
  isLoading: boolean
  error: string | null
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
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

function filterBankAccountsByUserId(accounts: BankAccount[], userId: string): BankAccount[] {
  const uid = userId.trim()
  if (!uid) return []
  return accounts.filter((a) => String(a.user_id ?? '').trim() === uid)
}

function upsertBankAccount(list: BankAccount[], account: BankAccount): BankAccount[] {
  const id = String(account.id ?? '').trim()
  if (!id) return list
  const next = list.filter((item) => String(item.id ?? '').trim() !== id)
  next.unshift(account)
  return next
}

function mergeBankAccounts(base: BankAccount[], extra: BankAccount[]): BankAccount[] {
  return extra.reduce((list, account) => upsertBankAccount(list, account), base)
}

export const useCuentasBancariasStore = defineStore('cuentasBancarias', {
  state: (): CuentasBancariasState => ({
    bankAccounts: [],
    bankAccountsByUser: {},
    transactionFormBankAccounts: [],
    transactionFormBankAccountsUserId: null,
    transactionFormBankAccountsLoading: false,
    _transactionFormBankAccountsLoadSeq: 0,
    banks: [],
    clientUsers: [],
    transactionFormUsers: [],
    isLoading: false,
    error: null,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    _clientUsersLoaded: false,
    _transactionFormUsersLoaded: false,
    _banksLoaded: false
  }),

  actions: {
    async loadBankAccounts(params?: { userId?: string; bank_country?: 'pe' | 'br'; account_flow?: 'origin' | 'destination' }) {
      const workspaceUserId = params?.userId?.trim()
      if (workspaceUserId && !params?.bank_country && !params?.account_flow) {
        const cached = this.bankAccountsByUser[workspaceUserId]
        if (cached) {
          this.bankAccounts = cached
          this.error = null
          return
        }
      }
      this.isLoading = true
      this.error = null
      try {
        const repo = getRepository()
        const useCase = new GetBankAccountsUseCase(repo)
        this.bankAccounts = await useCase.execute(params)
        if (workspaceUserId && !params?.bank_country && !params?.account_flow) {
          this.bankAccountsByUser[workspaceUserId] = this.bankAccounts
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al cargar cuentas bancarias'
      } finally {
        this.isLoading = false
      }
    },

    async loadBankAccountsForTransactionUser(userId?: string) {
      const id = userId?.trim()
      const requestSeq = ++this._transactionFormBankAccountsLoadSeq
      if (!id) {
        this.transactionFormBankAccounts = []
        this.transactionFormBankAccountsUserId = null
        this.transactionFormBankAccountsLoading = false
        return
      }
      this.transactionFormBankAccountsLoading = true
      this.transactionFormBankAccounts = []
      this.transactionFormBankAccountsUserId = null
      try {
        const repo = getRepository()
        const useCase = new GetBankAccountsUseCase(repo)
        const raw = await useCase.execute({ userId: id })
        if (requestSeq !== this._transactionFormBankAccountsLoadSeq) return
        this.transactionFormBankAccounts = mergeBankAccounts(
          filterBankAccountsByUserId(raw, id),
          filterBankAccountsByUserId(this.bankAccounts, id)
        )
        this.transactionFormBankAccountsUserId = id
      } catch (e) {
        if (requestSeq !== this._transactionFormBankAccountsLoadSeq) return
        console.warn('Error al cargar cuentas del cliente (transacción):', e)
        this.transactionFormBankAccounts = []
        this.transactionFormBankAccountsUserId = id
      } finally {
        if (requestSeq === this._transactionFormBankAccountsLoadSeq) {
          this.transactionFormBankAccountsLoading = false
        }
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
          role: user.role,
          identifications: user.identifications
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
        const fullPayload: CreateBankAccountPayload = {
          ...payload,
          user_id: userId
        }
        const repo = getRepository()
        const created = await repo.createBankAccount(fullPayload)
        const createdForUser = {
          ...created,
          user_id: String(created.user_id || userId)
        }
        this.bankAccounts = upsertBankAccount(this.bankAccounts, createdForUser)
        this.bankAccountsByUser[userId] = upsertBankAccount(
          this.bankAccountsByUser[userId] ?? [],
          createdForUser
        )
        await this.loadBankAccountsForTransactionUser(userId)
        this.transactionFormBankAccounts = upsertBankAccount(
          this.transactionFormBankAccounts,
          createdForUser
        )
        this.transactionFormBankAccountsUserId = userId
        return createdForUser
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al crear cuenta bancaria'
        throw e
      } finally {
        this.isCreating = false
      }
    },

    async updateBankAccount(payload: UpdateBankAccountPayload): Promise<BankAccount> {
      this.isUpdating = true
      this.error = null
      try {
        const repo = getRepository()
        const updated = await repo.updateBankAccount(payload)
        this.bankAccounts = upsertBankAccount(this.bankAccounts, updated)
        const updatedUserId = String(updated.user_id ?? '').trim()
        if (updatedUserId) {
          this.bankAccountsByUser[updatedUserId] = upsertBankAccount(
            this.bankAccountsByUser[updatedUserId] ?? [],
            updated
          )
        }
        if (
          this.transactionFormBankAccountsUserId &&
          String(updated.user_id) === this.transactionFormBankAccountsUserId
        ) {
          this.transactionFormBankAccounts = upsertBankAccount(
            this.transactionFormBankAccounts,
            updated
          )
        }
        return updated
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al actualizar cuenta bancaria'
        throw e
      } finally {
        this.isUpdating = false
      }
    },

    async deleteBankAccount(id: string): Promise<void> {
      this.isDeleting = true
      this.error = null
      try {
        const repo = getRepository()
        await repo.deleteBankAccount(id)
        this.bankAccounts = this.bankAccounts.filter((account) => account.id !== id)
        Object.entries(this.bankAccountsByUser).forEach(([userId, accounts]) => {
          if (!accounts?.some((account) => account.id === id)) return
          this.bankAccountsByUser[userId] = accounts.filter((account) => account.id !== id)
        })
        this.transactionFormBankAccounts = this.transactionFormBankAccounts.filter(
          (account) => account.id !== id
        )
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Error al eliminar cuenta bancaria'
        throw e
      } finally {
        this.isDeleting = false
      }
    }
  }
})
