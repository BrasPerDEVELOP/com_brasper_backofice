<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchUsers,
  fetchUserFilterOptions,
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
import {
  ALL_COUNTRIES,
  userCountryKey,
  useUserCountryOptions
} from '../composables/use_user_country_filter'
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
const countryFilter = ref(
  queryString(route.query.country)
    ? userCountryKey(queryString(route.query.country))
    : ALL_COUNTRIES
)
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

const debouncedSearch = ref(searchQuery.value)
let searchDebounceId: ReturnType<typeof setTimeout>
watch(
  searchQuery,
  (q) => {
    clearTimeout(searchDebounceId)
    searchDebounceId = setTimeout(() => {
      debouncedSearch.value = q
    }, 150)
  },
  { immediate: false }
)

const availableCountries = ref<string[]>([])
const { options: countryOptions } = useUserCountryOptions(availableCountries)
// The API owns every filter; pagination only divides its returned result for display.
const searchedUsers = computed(() => users.value)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(searchedUsers.value.length / perPage.value))
)

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return searchedUsers.value.slice(start, start + perPage.value)
})

let userRequestId = 0
async function loadUsers() {
  const requestId = ++userRequestId
  loading.value = true
  error.value = ''
  try {
    const role = canViewUsers.value ? roleSelectFilter.value.toLowerCase() : 'client'
    const params = {
      role: role !== 'todos' ? role : undefined,
      country: countryFilter.value !== ALL_COUNTRIES ? countryFilter.value : undefined,
      search: debouncedSearch.value.trim() || undefined
    }
    // Loading options also verifies that this API supports server-side country filtering.
    // Never silently fall back to filtering a full user list in the browser.
    const countries = await fetchUserFilterOptions(params.role)
    if (requestId !== userRequestId) return
    availableCountries.value = countries
    const result = await fetchUsers(params)
    if (requestId !== userRequestId) return
    users.value = result
    currentPage.value = Math.min(currentPage.value, totalPages.value)
  } catch (e) {
    if (requestId !== userRequestId) return
    error.value = e instanceof Error ? e.message : 'Error al cargar usuarios'
    users.value = []
  } finally {
    if (requestId === userRequestId) loading.value = false
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
  openMenuId.value = openMenuId.value === id ? null : id
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

watch([searchQuery, roleSelectFilter, countryFilter, perPage], () => {
  currentPage.value = 1
  openMenuId.value = null
})

watch([searchQuery, roleSelectFilter, countryFilter, perPage, currentPage], () => {
  const query = { ...route.query }
  if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
  else delete query.search
  if (roleSelectFilter.value !== 'todos') query.role = roleSelectFilter.value
  else delete query.role
  if (countryFilter.value !== ALL_COUNTRIES) query.country = countryFilter.value
  else delete query.country
  if (perPage.value !== 10) query.perPage = String(perPage.value)
  else delete query.perPage
  if (currentPage.value > 1) query.page = String(currentPage.value)
  else delete query.page
  void router.replace({ query })
})

watch([roleSelectFilter, countryFilter, debouncedSearch], loadUsers)
onUnmounted(() => {
  clearTimeout(searchDebounceId)
  userRequestId++
})

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

function safeFilePart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'usuario'
  )
}

function bankLabel(bankId: string): string {
  const bank = cuentasStore.banks.find((item) => item.id === bankId)
  if (!bank) return bankId
  return bank.currency ? `${bank.bank} (${bank.currency})` : bank.bank
}

function accountHolder(account: BankAccount): string {
  return (
    account.business_name ||
    [account.holder_names, account.holder_surnames].filter(Boolean).join(' ') ||
    ''
  )
}

function exportUsersToExcel() {
  const headers = [
    'uuid',
    'nombres',
    'email',
    'tipo_documento',
    'n_documento',
    'rol',
    'pais',
    'codigo_zona_local',
    'nombre_zona_local'
  ]
  const rows = searchedUsers.value.map((u) => {
    const documentType = getDocumentType(u)
    const documentNumber = getDocumentNumber(u)
    return [
      u.id,
      u.name ?? '',
      u.email ?? '',
      documentType === '-' ? '' : documentType,
      documentNumber === '-' ? '' : documentNumber,
      USER_ROLE_LABELS[u.role as keyof typeof USER_ROLE_LABELS] ?? u.role ?? '',
      u.country ?? '',
      u.local_area_code ?? '',
      u.local_area_name ?? ''
    ]
  })
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
  const filename = `usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

async function exportUserToExcel(user: UserListItem) {
  openMenuId.value = null
  error.value = ''
  try {
    const isClientUser = isClient(user)
    if (isClientUser && canViewBankAccounts.value) {
      await Promise.all([
        cuentasStore.loadBankAccounts({ userId: user.id }),
        cuentasStore.loadBanks()
      ])
    }

    const roleLabel =
      USER_ROLE_LABELS[user.role as keyof typeof USER_ROLE_LABELS] ?? user.role ?? ''
    const userRows = [
      ['Campo', 'Valor'],
      ['UUID', user.id],
      ['Nombres', user.names ?? user.name ?? ''],
      ['Apellidos', user.lastnames ?? ''],
      ['Email', user.email === '-' ? '' : user.email],
      ['Rol', roleLabel],
      ['Tipo documento', getDocumentType(user) === '-' ? '' : getDocumentType(user)],
      ['Numero documento', getDocumentNumber(user) === '-' ? '' : getDocumentNumber(user)],
      ['Telefono', [user.code_phone, user.phone].filter(Boolean).join(' ')]
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(userRows), 'Usuario')

    if (isClientUser && canViewBankAccounts.value) {
      const accounts = cuentasStore.bankAccounts.filter((account) => account.user_id === user.id)
      const accountRows = accounts.map((account) => [
        account.id,
        account.bank_country?.toUpperCase() ?? '',
        account.account_flow === 'origin' ? 'Origen' : 'Destino',
        bankLabel(account.bank_id),
        account.account_holder_type?.toLowerCase().includes('legal') ? 'Juridica' : 'Natural',
        accountHolder(account),
        account.document_number ?? '',
        account.ruc_number ?? '',
        account.account_number ?? '',
        account.cci_number ?? '',
        account.pix_key ?? '',
        account.pix_key_type ?? '',
        account.created_at ?? '',
        account.updated_at ?? ''
      ])
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [
            'uuid',
            'pais',
            'flujo',
            'banco',
            'tipo_titular',
            'titular',
            'documento',
            'ruc',
            'numero_cuenta',
            'cci',
            'pix',
            'tipo_pix',
            'creado',
            'actualizado'
          ],
          ...accountRows
        ]),
        'Cuentas bancarias'
      )
    }

    const filename = `usuario_${safeFilePart(user.name || user.email || user.id)}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, filename)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo generar el Excel del usuario'
  }
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
    v-model:country="countryFilter"
    :country-options="countryOptions"
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
      @close-menu="openMenuId = null"
      @edit="openEditModal"
      @reset-password="openResetPasswordModal"
      @view-accounts="goToUserBankAccounts"
      @export-excel="exportUserToExcel"
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
