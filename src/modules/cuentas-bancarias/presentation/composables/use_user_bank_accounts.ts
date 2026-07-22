import { computed, shallowRef, watch, type Ref } from 'vue'
import type { BankAccount } from '../../domain/models'
import type { UserOption } from '../../infrastructure/adapters/users_api_adapter'

export type AccountStatusFilter = 'all' | 'with' | 'without'

export interface UserBankAccountGroup {
  user: UserOption
  accounts: BankAccount[]
  countries: string[]
  hasAccounts: boolean
  primaryIdentification: UserOption['identifications'][number] | null
}

export function groupUsersWithBankAccounts(
  users: UserOption[],
  accounts: BankAccount[]
): UserBankAccountGroup[] {
  const accountsByUser = new Map<string, BankAccount[]>()
  for (const account of accounts) {
    const userId = String(account.user_id ?? '').trim()
    if (!userId) continue
    const current = accountsByUser.get(userId) ?? []
    current.push(account)
    accountsByUser.set(userId, current)
  }

  return users.map((user) => {
    const userAccounts = accountsByUser.get(user.id) ?? []
    const countries = Array.from(
      new Set(userAccounts.map((account) => account.bank_country.toUpperCase()).filter(Boolean))
    ).sort()
    return {
      user,
      accounts: userAccounts,
      countries,
      hasAccounts: userAccounts.length > 0,
      primaryIdentification:
        user.identifications.find((item) => item.is_primary) ?? user.identifications[0] ?? null
    }
  })
}

export function useUserBankAccounts(options: {
  users: Ref<UserOption[]>
  accounts: Ref<BankAccount[]>
  perPage?: number
}) {
  const searchQuery = shallowRef('')
  const debouncedSearch = shallowRef('')
  const statusFilter = shallowRef<AccountStatusFilter>('all')
  const selectedUserId = shallowRef<string | null>(null)
  const currentPage = shallowRef(1)
  const perPage = shallowRef(options.perPage ?? 10)
  let debounceId: ReturnType<typeof setTimeout> | undefined

  watch(searchQuery, (value) => {
    if (debounceId) clearTimeout(debounceId)
    debounceId = setTimeout(() => {
      debouncedSearch.value = value
    }, 150)
  }, { immediate: true })

  const groups = computed(() => groupUsersWithBankAccounts(options.users.value, options.accounts.value))
  const counts = computed(() => ({
    all: groups.value.length,
    with: groups.value.filter((group) => group.hasAccounts).length,
    without: groups.value.filter((group) => !group.hasAccounts).length
  }))
  const filteredGroups = computed(() => {
    const query = debouncedSearch.value.trim().toLocaleLowerCase('es')
    return groups.value.filter((group) => {
      if (statusFilter.value === 'with' && !group.hasAccounts) return false
      if (statusFilter.value === 'without' && group.hasAccounts) return false
      if (!query) return true
      const documents = group.user.identifications
        .map((item) => `${item.document_type} ${item.document_number}`)
        .join(' ')
      return `${group.user.name} ${group.user.email} ${documents}`
        .toLocaleLowerCase('es')
        .includes(query)
    })
  })
  const totalPages = computed(() => Math.max(1, Math.ceil(filteredGroups.value.length / perPage.value)))
  const paginatedGroups = computed(() => {
    const start = (currentPage.value - 1) * perPage.value
    return filteredGroups.value.slice(start, start + perPage.value)
  })
  const selectedGroup = computed(() =>
    groups.value.find((group) => group.user.id === selectedUserId.value) ?? null
  )

  watch([statusFilter, debouncedSearch, perPage], () => { currentPage.value = 1 })
  watch(groups, (value) => {
    if (!value.length) selectedUserId.value = null
    else if (!value.some((group) => group.user.id === selectedUserId.value)) {
      selectedUserId.value = value[0]?.user.id ?? null
    }
  }, { immediate: true })

  function selectUser(userId: string) { selectedUserId.value = userId }
  function goToPage(page: number) {
    currentPage.value = Math.max(1, Math.min(page, totalPages.value))
  }

  return {
    searchQuery,
    statusFilter,
    selectedUserId,
    currentPage,
    perPage,
    groups,
    counts,
    filteredGroups,
    paginatedGroups,
    selectedGroup,
    totalPages,
    selectUser,
    goToPage
  }
}
