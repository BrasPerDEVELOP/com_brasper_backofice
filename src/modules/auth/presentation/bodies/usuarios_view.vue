<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchUsers,
  deleteUser,
  USER_ROLES,
  type UserListItem
} from '../../infrastructure/adapters/users_management_api_adapter'
import { USER_ROLE_LABELS } from '../../domain/models'
import * as XLSX from 'xlsx'
import UsuarioCreateFormModal from '@/interface/components/UsuarioCreateFormModal.vue'
import CuentaBancariaCreateFormModal from '@/interface/components/CuentaBancariaCreateFormModal.vue'
import CuentaBancariaEditFormModal from '@/interface/components/CuentaBancariaEditFormModal.vue'
import UserWorkspacePanel from '../components/UserWorkspacePanel.vue'
import UserManagementHeader from '../components/UserManagementHeader.vue'
import UserFiltersBar from '../components/UserFiltersBar.vue'
import UserDirectoryTable from '../components/UserDirectoryTable.vue'
import UserResetPasswordModal from '../components/UserResetPasswordModal.vue'
import UserImportExcelModal from '../components/UserImportExcelModal.vue'
import {
  queryString,
  shouldShowUserRoleField,
  useUserWorkspace
} from '../composables/use_user_workspace'
import { useCuentasBancariasStore } from '@/modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import type { BankAccount } from '@/modules/cuentas-bancarias/domain/models'
import { useAuthStore } from '../controllers/use_auth_store_controller'
import { ConfirmDialog } from '@interface/widgets'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const cuentasStore = useCuentasBancariasStore()
const workspace = useUserWorkspace({ query: toRef(route, 'query'), router })
const canViewUsers = computed(() => authStore.hasPermission('users.view'))
const canViewBankAccounts = computed(() => authStore.hasPermission('bank_accounts.view'))
const canCreateBankAccounts = computed(() => authStore.hasPermission('bank_accounts.create'))
const canUpdateBankAccounts = computed(() => authStore.hasPermission('bank_accounts.update'))
const canDeleteBankAccounts = computed(() => authStore.hasPermission('bank_accounts.delete'))

function goToUserBankAccounts(user: UserListItem) {
  openMenuId.value = null
  workspace.selectUser(user.id, 'accounts')
}

const users = ref<UserListItem[]>([])
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const showCreateModal = ref(false)
const showImportModal = ref(false)
const selectedUser = ref<UserListItem | null>(null)
const showBankAccountCreateModal = ref(false)
const showBankAccountEditModal = ref(false)
const editingBankAccount = ref<BankAccount | null>(null)
const deletingBankAccount = ref<BankAccount | null>(null)
const showBankAccountDeleteConfirm = ref(false)
const bankAccountDeleteError = ref('')
const highlightedAccountId = ref<string | null>(null)
const accountSuccessMessage = ref('')
const searchQuery = ref(queryString(route.query.search) ?? '')
const openMenuId = ref<string | null>(null)
const resetPasswordUser = ref<UserListItem | null>(null)

const requestedRole = queryString(route.query.role)
const roleSelectFilter = ref<string>(
  canViewUsers.value && requestedRole ? requestedRole : canViewUsers.value ? 'todos' : 'client'
)

const canCreateUsers = computed(() => authStore.hasPermission('users.create'))
const canUpdateUsers = computed(() => authStore.hasPermission('users.update'))
const canDeleteUsers = computed(() => authStore.hasPermission('users.delete'))
const canResetPasswords = computed(() => authStore.hasPermission('users.reset_password'))

const workspaceUser = computed(
  () => users.value.find((user) => user.id === workspace.selectedUserId.value) ?? null
)

function isClient(user: UserListItem | null): boolean {
  return ['client', 'cliente'].includes((user?.role ?? '').toLowerCase())
}

const requestedPerPage = Number(queryString(route.query.perPage))
const perPage = ref([5, 10, 25, 50].includes(requestedPerPage) ? requestedPerPage : 10)
const requestedPage = Number(queryString(route.query.page))
const currentPage = ref(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1)

const roleOptions = computed(() => [
  ...(canViewUsers.value ? [{ value: 'todos', label: 'Todos' }] : []),
  ...USER_ROLES.filter((role) => canViewUsers.value || role === 'client').map((r) => ({
    value: r,
    label: USER_ROLE_LABELS[r]
  }))
])

const perPageStr = computed({
  get: () => String(perPage.value),
  set: (v) => {
    perPage.value = Number(v) || 10
  }
})

const createModalDefaultRole = computed(() =>
  roleSelectFilter.value.toLowerCase() === 'todos' ? 'client' : roleSelectFilter.value
)
const showUserRoleField = computed(() =>
  shouldShowUserRoleField({
    canUpdateUsers: canUpdateUsers.value,
    isEditing: selectedUser.value !== null,
    roleFilter: roleSelectFilter.value
  })
)

const debouncedSearch = ref('')
let searchDebounceId: ReturnType<typeof setTimeout>
watch(
  searchQuery,
  (q) => {
    clearTimeout(searchDebounceId)
    searchDebounceId = setTimeout(() => {
      debouncedSearch.value = q
    }, 150)
  },
  { immediate: true }
)

const filteredByRole = computed(() => {
  const role = roleSelectFilter.value.toLowerCase()
  if (role === 'todos') return users.value
  return users.value.filter((u) => (u.role ?? '').toLowerCase() === role)
})

const searchedUsers = computed(() => {
  const list = filteredByRole.value
  const q = debouncedSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((u) => {
    const name = (u.name ?? '').toLowerCase()
    const email = (u.email ?? '').toLowerCase()
    const documents = u.identifications
      .map((item) => `${item.document_type} ${item.document_number}`.toLowerCase())
      .join(' ')
    return name.includes(q) || email.includes(q) || documents.includes(q)
  })
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(searchedUsers.value.length / perPage.value))
)

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return searchedUsers.value.slice(start, start + perPage.value)
})

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    const role = canViewUsers.value ? roleSelectFilter.value.toLowerCase() : 'client'
    const params = role !== 'todos' ? { role } : undefined
    users.value = await fetchUsers(params)
    currentPage.value = Math.min(currentPage.value, totalPages.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar usuarios'
    users.value = []
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  if (!canCreateUsers.value) return
  error.value = ''
  successMessage.value = ''
  selectedUser.value = null
  showCreateModal.value = true
}

function openEditModal(user: UserListItem) {
  if (!canUpdateUsers.value) return
  error.value = ''
  successMessage.value = ''
  openMenuId.value = null
  selectedUser.value = user
  showCreateModal.value = true
}

async function onUserSaved(savedUser: UserListItem) {
  const wasEditing = Boolean(selectedUser.value)
  successMessage.value = wasEditing
    ? 'Usuario actualizado correctamente'
    : 'Usuario creado correctamente. Ya puedes registrar su primera cuenta.'
  selectedUser.value = null
  await loadUsers()
  workspace.selectUser(
    savedUser.id,
    !wasEditing && isClient(savedUser) && canViewBankAccounts.value ? 'accounts' : 'profile'
  )
}

function openCreateBankAccount(userId: string) {
  if (!canCreateBankAccounts.value) return
  workspace.selectUser(userId, 'accounts')
  accountSuccessMessage.value = ''
  showBankAccountCreateModal.value = true
}

function openEditBankAccount(account: BankAccount) {
  if (!canUpdateBankAccounts.value) return
  editingBankAccount.value = account
  accountSuccessMessage.value = ''
  showBankAccountEditModal.value = true
}

function openDeleteBankAccount(account: BankAccount) {
  if (!canDeleteBankAccounts.value) return
  deletingBankAccount.value = account
  // El error del store se pinta dentro del diálogo; limpiarlo evita arrastrar
  // el de una operación anterior.
  cuentasStore.error = null
  bankAccountDeleteError.value = ''
  accountSuccessMessage.value = ''
  showBankAccountDeleteConfirm.value = true
}

function cancelDeleteBankAccount() {
  deletingBankAccount.value = null
  bankAccountDeleteError.value = ''
}

async function confirmDeleteBankAccount() {
  const account = deletingBankAccount.value
  if (!account) return
  bankAccountDeleteError.value = ''
  try {
    await cuentasStore.deleteBankAccount(account.id)
    showBankAccountDeleteConfirm.value = false
    deletingBankAccount.value = null
    if (highlightedAccountId.value === account.id) highlightedAccountId.value = null
    accountSuccessMessage.value = 'Cuenta bancaria eliminada correctamente.'
  } catch (e) {
    // El diálogo sigue abierto: el error va dentro, no detrás del overlay.
    bankAccountDeleteError.value =
      cuentasStore.error || (e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.')
  }
}

function highlightAccount(account: BankAccount, message: string) {
  highlightedAccountId.value = account.id
  accountSuccessMessage.value = message
  window.setTimeout(() => {
    if (highlightedAccountId.value === account.id) highlightedAccountId.value = null
  }, 8000)
}

function onBankAccountCreated(account: BankAccount) {
  workspace.selectUser(account.user_id, 'accounts')
  highlightAccount(account, 'Cuenta bancaria creada correctamente.')
}

function onBankAccountUpdated(account: BankAccount) {
  workspace.selectUser(account.user_id, 'accounts')
  highlightAccount(account, 'Cuenta bancaria actualizada correctamente.')
}

async function onUsersImported(result: { created: number; errors: string[] }) {
  successMessage.value = result.errors.length
    ? `Se importaron ${result.created} usuario(s). Errores: ${result.errors.length}`
    : `Se importaron ${result.created} usuario(s) correctamente`
  error.value = result.errors.slice(0, 5).join('; ')
  await loadUsers()
}

const deletingId = ref<string | null>(null)
const pendingDelete = ref<UserListItem | null>(null)
const showDeleteConfirm = ref(false)
const deleteConfirmMessage = computed(() =>
  pendingDelete.value
    ? `¿Eliminar a ${pendingDelete.value.name} (${pendingDelete.value.email})?`
    : ''
)

function toggleMenu(id: string) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    return
  }
  openMenuId.value = id
  nextTick(() => {
    const close = () => {
      openMenuId.value = null
      document.removeEventListener('click', close)
    }
    setTimeout(() => document.addEventListener('click', close), 0)
  })
}

function handleDelete(u: UserListItem): void {
  if (!canDeleteUsers.value) return
  pendingDelete.value = u
  showDeleteConfirm.value = true
}

async function confirmDelete(): Promise<void> {
  const u = pendingDelete.value
  showDeleteConfirm.value = false
  pendingDelete.value = null
  if (!u) return
  openMenuId.value = null
  deletingId.value = u.id
  error.value = ''
  try {
    await deleteUser(u.id)
    successMessage.value = 'Usuario eliminado correctamente'
    await loadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar usuario'
  } finally {
    deletingId.value = null
  }
}

function openResetPasswordModal(user: UserListItem) {
  if (!canResetPasswords.value) return
  openMenuId.value = null
  resetPasswordUser.value = user
}

function closeResetPasswordModal() {
  resetPasswordUser.value = null
}

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

watch([searchQuery, roleSelectFilter, perPage], () => {
  currentPage.value = 1
})

watch([searchQuery, roleSelectFilter, perPage, currentPage], () => {
  const query = { ...route.query }
  if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
  else delete query.search
  if (roleSelectFilter.value !== 'todos') query.role = roleSelectFilter.value
  else delete query.role
  if (perPage.value !== 10) query.perPage = String(perPage.value)
  else delete query.perPage
  if (currentPage.value > 1) query.page = String(currentPage.value)
  else delete query.page
  void router.replace({ query })
})

watch(roleSelectFilter, loadUsers)

watch(showCreateModal, (open) => {
  if (!open) selectedUser.value = null
})

watch(
  [workspaceUser, workspace.activeTab, canViewBankAccounts],
  async ([user, tab, canView]) => {
    const userId = user?.id ?? null
    if (!userId || tab !== 'accounts' || !canView || !isClient(user)) return
    accountSuccessMessage.value = ''
    await Promise.all([cuentasStore.loadBankAccounts({ userId }), cuentasStore.loadBanks()])
  },
  { immediate: true }
)

function getDocumentType(u: UserListItem): string {
  if (u.identifications.length > 1) {
    return u.identifications.map((item) => item.document_type.toUpperCase()).join(', ')
  }
  return (u.document_type ?? '-').toUpperCase()
}

function getDocumentNumber(u: UserListItem): string {
  if (u.identifications.length > 1) {
    return u.identifications.map((item) => item.document_number).join(', ')
  }
  return u.document_number ?? '-'
}

function exportUsersToExcel() {
  const headers = ['uuid', 'nombres', 'email', 'tipo_documento', 'n_documento', 'rol']
  const rows = searchedUsers.value.map((u) => {
    const documentType = getDocumentType(u)
    const documentNumber = getDocumentNumber(u)
    return [
      u.id,
      u.name ?? '',
      u.email ?? '',
      documentType === '-' ? '' : documentType,
      documentNumber === '-' ? '' : documentNumber,
      USER_ROLE_LABELS[u.role as keyof typeof USER_ROLE_LABELS] ?? u.role ?? ''
    ]
  })
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
  const filename = `usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

onMounted(async () => {
  await loadUsers()
  const requested = workspace.selectedUserId.value
  if (requested && !users.value.some((user) => user.id === requested)) {
    workspace.clearSelection()
  }
})
</script>

<template>
  <UserManagementHeader
    :can-create="canCreateUsers"
    :can-export="canViewUsers"
    @create="openCreateModal"
    @import="showImportModal = true"
    @export="exportUsersToExcel"
  />
  <UserFiltersBar
    v-model:search="searchQuery"
    v-model:role="roleSelectFilter"
    :role-options="roleOptions"
    :total="searchedUsers.length"
  />

  <!-- Content -->
  <p v-if="error" class="mb-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
    {{ error }}
  </p>
  <p
    v-if="successMessage"
    class="mb-4 rounded-lg bg-brasper-cyanLight/15 px-4 py-3 text-sm text-brasper-indigoDark"
  >
    {{ successMessage }}
  </p>

  <p
    v-if="accountSuccessMessage"
    class="mb-4 rounded-lg bg-[#dcfce7] px-4 py-3 text-sm font-medium text-[#166534]"
  >
    {{ accountSuccessMessage }}
  </p>

  <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
    <UserDirectoryTable
      v-model:per-page="perPageStr"
      :users="paginatedUsers"
      :total-results="searchedUsers.length"
      :total-users="users.length"
      :loading="loading"
      :selected-user-id="workspace.selectedUserId.value"
      :open-menu-id="openMenuId"
      :deleting-id="deletingId"
      :current-page="currentPage"
      :total-pages="totalPages"
      :can-update="canUpdateUsers"
      :can-delete="canDeleteUsers"
      :can-reset-password="canResetPasswords"
      :can-view-accounts="canViewBankAccounts"
      @select="(user) => workspace.selectUser(user.id, 'profile')"
      @toggle-menu="toggleMenu"
      @edit="openEditModal"
      @reset-password="openResetPasswordModal"
      @view-accounts="goToUserBankAccounts"
      @delete="handleDelete"
      @go-to-page="goToPage"
    />

    <UserWorkspacePanel
      class="xl:sticky xl:top-20"
      :user="workspaceUser"
      :tab="workspace.activeTab.value"
      :accounts="cuentasStore.bankAccounts"
      :banks="cuentasStore.banks"
      :accounts-loading="cuentasStore.isLoading"
      :accounts-error="cuentasStore.error"
      :can-view-accounts="canViewBankAccounts"
      :can-create-account="canCreateBankAccounts"
      :can-update-account="canUpdateBankAccounts"
      :can-delete-account="canDeleteBankAccounts"
      :can-update-user="canUpdateUsers"
      :highlighted-account-id="highlightedAccountId"
      @update:tab="workspace.selectTab"
      @edit-user="openEditModal"
      @create-account="openCreateBankAccount"
      @edit-account="openEditBankAccount"
      @delete-account="openDeleteBankAccount"
    />
  </div>

  <UsuarioCreateFormModal
    v-model="showCreateModal"
    :show-role-field="showUserRoleField"
    :default-role="createModalDefaultRole"
    :user="selectedUser"
    @created="onUserSaved"
  />

  <CuentaBancariaCreateFormModal
    v-model="showBankAccountCreateModal"
    variant="accounts"
    account-flow="destination"
    bank-country="pe"
    holder-type="natural"
    :locked-user-id="workspace.selectedUserId.value ?? undefined"
    @created="onBankAccountCreated"
  />

  <CuentaBancariaEditFormModal
    v-model="showBankAccountEditModal"
    :account="editingBankAccount"
    @saved="onBankAccountUpdated"
  />

  <UserResetPasswordModal
    :user="resetPasswordUser"
    @close="closeResetPasswordModal"
    @saved="successMessage = 'Contraseña temporal actualizada correctamente'"
  />
  <UserImportExcelModal
    v-model="showImportModal"
    :default-role="createModalDefaultRole"
    @imported="onUsersImported"
  />

  <ConfirmDialog
    v-model="showDeleteConfirm"
    title="Eliminar usuario"
    :message="deleteConfirmMessage"
    confirm-text="Eliminar"
    :loading="deletingId !== null"
    @confirm="confirmDelete"
  />
  <ConfirmDialog
    v-model="showBankAccountDeleteConfirm"
    title="Eliminar cuenta bancaria"
    message="La cuenta dejará de estar disponible para este cliente y para nuevas transacciones. Esta acción no se puede deshacer."
    confirm-text="Eliminar cuenta"
    :loading="cuentasStore.isDeleting"
    @confirm="confirmDeleteBankAccount"
    @cancel="cancelDeleteBankAccount"
  >
    <p
      v-if="bankAccountDeleteError"
      class="mt-4 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]"
    >
      {{ bankAccountDeleteError }}
    </p>
  </ConfirmDialog>
</template>
