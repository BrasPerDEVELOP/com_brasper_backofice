<script setup lang="ts">
import { computed, onMounted, shallowRef, toRef } from 'vue'
import { useRoute } from 'vue-router'
import CuentaBancariaCreateFormModal from '@/interface/components/CuentaBancariaCreateFormModal.vue'
import CuentaBancariaEditFormModal from '@/interface/components/CuentaBancariaEditFormModal.vue'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import BankAccountUsersFilters from '../components/BankAccountUsersFilters.vue'
import BankAccountUsersTable from '../components/BankAccountUsersTable.vue'
import UserBankAccountsPanel from '../components/UserBankAccountsPanel.vue'
import { useUserBankAccounts } from '../composables/use_user_bank_accounts'
import { useCuentasBancariasStore } from '../controllers/use_cuentas_bancarias_store_controller'
import type { BankAccount } from '../../domain/models'

const authStore = useAuthStore()
const route = useRoute()
const cuentasStore = useCuentasBancariasStore()
const showCreateModal = shallowRef(false)
const createForUserId = shallowRef<string | null>(null)
const showEditModal = shallowRef(false)
const editingAccount = shallowRef<BankAccount | null>(null)
const highlightedAccountId = shallowRef<string | null>(null)
const successMessage = shallowRef('')

const canCreate = computed(() => authStore.hasPermission('bank_accounts.create'))
const canUpdate = computed(() => authStore.hasPermission('bank_accounts.update'))
const browser = useUserBankAccounts({
  users: toRef(cuentasStore, 'clientUsers'),
  accounts: toRef(cuentasStore, 'bankAccounts')
})

/** Sin `userId` abre en modo selector de cliente (botón global del header). */
function openCreate(userId?: string) {
  if (!canCreate.value) return
  createForUserId.value = userId ?? null
  showCreateModal.value = true
}

const lastCreatedUserId = shallowRef<string | null>(null)

function onCreated(account: BankAccount) {
  highlightedAccountId.value = account.id
  lastCreatedUserId.value = account.user_id
  browser.selectUser(account.user_id)
  successMessage.value = 'Cuenta bancaria creada correctamente.'
  window.setTimeout(() => {
    if (highlightedAccountId.value === account.id) highlightedAccountId.value = null
    successMessage.value = ''
  }, 8000)
}

function createAnotherForLastUser() {
  if (!lastCreatedUserId.value) return
  successMessage.value = ''
  openCreate(lastCreatedUserId.value)
}

function openEdit(account: BankAccount) {
  if (!canUpdate.value) return
  cuentasStore.error = null
  editingAccount.value = account
  showEditModal.value = true
}

function onUpdated(account: BankAccount) {
  highlightedAccountId.value = account.id
  lastCreatedUserId.value = null
  browser.selectUser(account.user_id)
  successMessage.value = 'Cuenta bancaria actualizada correctamente.'
  window.setTimeout(() => {
    if (highlightedAccountId.value === account.id) highlightedAccountId.value = null
    successMessage.value = ''
  }, 8000)
}

onMounted(async () => {
  // Llegada desde /app/usuarios ("Ver cuentas"): preselecciona al usuario.
  const requestedUserId = typeof route.query.user === 'string' ? route.query.user.trim() : ''
  if (requestedUserId) browser.selectUser(requestedUserId)
  await Promise.all([
    cuentasStore.loadClientUsers(true),
    cuentasStore.loadBankAccounts(),
    cuentasStore.loadBanks()
  ])
})
</script>

<template>
  <section class="space-y-5">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div><h1 class="text-2xl font-semibold text-[#1f2937]">Usuarios y cuentas bancarias</h1><p class="mt-1 text-sm text-[#6b7280]">Consulta quién tiene cuentas registradas y crea nuevas cuentas sin entrar a una transacción.</p></div>
      <button v-if="canCreate" type="button" class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark" @click="openCreate()">+ Crear cuenta</button>
    </header>

    <p v-if="successMessage" class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#dcfce7] px-4 py-3 text-sm font-medium text-[#166534]">
      {{ successMessage }}
      <button v-if="canCreate && lastCreatedUserId" type="button" class="rounded-lg border border-[#166534]/30 px-3 py-1.5 text-xs font-semibold text-[#166534] transition hover:bg-[#bbf7d0]" @click="createAnotherForLastUser">Crear otra cuenta para este cliente</button>
    </p>
    <p v-if="cuentasStore.error" class="rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">{{ cuentasStore.error }}</p>

    <BankAccountUsersFilters v-model:search="browser.searchQuery.value" v-model:status="browser.statusFilter.value" :counts="browser.counts.value" />

    <div class="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
      <div class="min-w-0 space-y-4">
        <BankAccountUsersTable :groups="browser.paginatedGroups.value" :selected-user-id="browser.selectedUserId.value" :can-create="canCreate" :loading="cuentasStore.isLoading" @select="browser.selectUser" @create="openCreate" />
        <div class="flex items-center justify-between text-sm text-[#6b7280]"><span>{{ browser.filteredGroups.value.length }} usuarios · Página {{ browser.currentPage.value }} de {{ browser.totalPages.value }}</span><div class="flex gap-2"><button type="button" class="rounded border border-[#e5e7eb] px-3 py-2 disabled:opacity-40" :disabled="browser.currentPage.value <= 1" @click="browser.goToPage(browser.currentPage.value - 1)">Anterior</button><button type="button" class="rounded border border-[#e5e7eb] px-3 py-2 disabled:opacity-40" :disabled="browser.currentPage.value >= browser.totalPages.value" @click="browser.goToPage(browser.currentPage.value + 1)">Siguiente</button></div></div>
      </div>
      <UserBankAccountsPanel class="xl:sticky xl:top-20 xl:self-start" :group="browser.selectedGroup.value" :banks="cuentasStore.banks" :can-create="canCreate" :can-update="canUpdate" :highlighted-account-id="highlightedAccountId" @create="openCreate" @edit="openEdit" />
    </div>
  </section>

  <CuentaBancariaCreateFormModal v-model="showCreateModal" variant="accounts" account-flow="destination" bank-country="pe" holder-type="natural" :locked-user-id="createForUserId ?? undefined" @created="onCreated" />
  <CuentaBancariaEditFormModal v-model="showEditModal" :account="editingAccount" @saved="onUpdated" />
</template>
