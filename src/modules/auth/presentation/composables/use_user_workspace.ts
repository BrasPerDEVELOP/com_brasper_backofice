import { computed, shallowRef, watch, type Ref } from 'vue'
import type { LocationQuery, Router } from 'vue-router'

export type UserWorkspaceTab = 'profile' | 'accounts'

export function normalizeUserWorkspaceTab(value: unknown): UserWorkspaceTab {
  return value === 'accounts' ? 'accounts' : 'profile'
}
export function queryString(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

export function shouldShowUserRoleField(options: {
  canUpdateUsers: boolean
  isEditing: boolean
  roleFilter: string
}): boolean {
  if (!options.canUpdateUsers) return false
  return options.isEditing || options.roleFilter.trim().toLowerCase() === 'todos'
}

export function useUserWorkspace(options: { query: Ref<LocationQuery>; router: Router }) {
  const selectedUserId = shallowRef<string | null>(queryString(options.query.value.user))
  const activeTab = shallowRef<UserWorkspaceTab>(
    normalizeUserWorkspaceTab(queryString(options.query.value.tab))
  )

  const hasSelection = computed(() => selectedUserId.value !== null)

  async function syncQuery() {
    const nextQuery: Record<string, string> = {}
    for (const [key, value] of Object.entries(options.query.value)) {
      const normalized = queryString(value)
      if (normalized && key !== 'user' && key !== 'tab') nextQuery[key] = normalized
    }
    if (selectedUserId.value) nextQuery.user = selectedUserId.value
    if (selectedUserId.value || activeTab.value === 'accounts') nextQuery.tab = activeTab.value
    await options.router.replace({ query: nextQuery })
  }

  function selectUser(userId: string, tab: UserWorkspaceTab = activeTab.value) {
    const normalized = userId.trim()
    if (!normalized) return
    selectedUserId.value = normalized
    activeTab.value = tab
    void syncQuery()
  }

  function selectTab(tab: UserWorkspaceTab) {
    activeTab.value = tab
    void syncQuery()
  }

  function clearSelection() {
    selectedUserId.value = null
    activeTab.value = 'profile'
    void syncQuery()
  }

  watch(
    options.query,
    (query) => {
      selectedUserId.value = queryString(query.user)
      activeTab.value = normalizeUserWorkspaceTab(queryString(query.tab))
    },
    { deep: true }
  )

  return {
    selectedUserId,
    activeTab,
    hasSelection,
    selectUser,
    selectTab,
    clearSelection
  }
}
