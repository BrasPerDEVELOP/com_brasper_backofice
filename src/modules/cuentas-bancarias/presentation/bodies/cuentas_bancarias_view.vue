<script setup lang="ts">
import { computed, onMounted, shallowRef, toRef } from 'vue'
import CuentaBancariaCreateFormModal from '@/interface/components/CuentaBancariaCreateFormModal.vue'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import BankAccountUsersFilters from '../components/BankAccountUsersFilters.vue'
import BankAccountUsersTable from '../components/BankAccountUsersTable.vue'
import UserBankAccountsPanel from '../components/UserBankAccountsPanel.vue'
import { useUserBankAccounts } from '../composables/use_user_bank_accounts'
import { useCuentasBancariasStore } from '../controllers/use_cuentas_bancarias_store_controller'
import type { BankAccount } from '../../domain/models'

const authStore = useAuthStore()
const cuentasStore = useCuentasBancariasStore()
const showCreateModal = shallowRef(false)
const createForUserId = shallowRef<string | null>(null)
const highlightedAccountId = shallowRef<string | null>(null)
const successMessage = shallowRef('')

const canCreate = computed(() => authStore.hasPermission('bank_accounts.create'))
const browser = useUserBankAccounts({
  users: toRef(cuentasStore, 'clientUsers'),
  accounts: toRef(cuentasStore, 'bankAccounts')
})

function openCreate(userId?: string) {
  if (!canCreate.value) return
  createForUserId.value = userId ?? browser.selectedUserId.value
  showCreateModal.value = true
}

function onCreated(account: BankAccount) {
  highlightedAccountId.value = account.id
  browser.selectUser(account.user_id)
  successMessage.value = 'Cuenta bancaria creada correctamente.'
  window.setTimeout(() => {
    if (highlightedAccountId.value === account.id) highlightedAccountId.value = null
    successMessage.value = ''
  }, 5000)
}

onMounted(async () => {
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
      <button v-if="canCreate" type="button" class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark" :disabled="!browser.selectedUserId.value" @click="openCreate()">+ Crear cuenta</button>
    </header>

    <p v-if="successMessage" class="rounded-lg bg-[#dcfce7] px-4 py-3 text-sm font-medium text-[#166534]">{{ successMessage }}</p>
    <p v-if="cuentasStore.error" class="rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">{{ cuentasStore.error }}</p>

    <BankAccountUsersFilters v-model:search="browser.searchQuery.value" v-model:status="browser.statusFilter.value" :counts="browser.counts.value" />

    <div class="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
      <div class="min-w-0 space-y-4">
        <BankAccountUsersTable :groups="browser.paginatedGroups.value" :selected-user-id="browser.selectedUserId.value" :can-create="canCreate" :loading="cuentasStore.isLoading" @select="browser.selectUser" @create="openCreate" />
        <div class="flex items-center justify-between text-sm text-[#6b7280]"><span>{{ browser.filteredGroups.value.length }} usuarios · Página {{ browser.currentPage.value }} de {{ browser.totalPages.value }}</span><div class="flex gap-2"><button type="button" class="rounded border border-[#e5e7eb] px-3 py-2 disabled:opacity-40" :disabled="browser.currentPage.value <= 1" @click="browser.goToPage(browser.currentPage.value - 1)">Anterior</button><button type="button" class="rounded border border-[#e5e7eb] px-3 py-2 disabled:opacity-40" :disabled="browser.currentPage.value >= browser.totalPages.value" @click="browser.goToPage(browser.currentPage.value + 1)">Siguiente</button></div></div>
      </div>
      <UserBankAccountsPanel class="xl:sticky xl:top-20 xl:self-start" :group="browser.selectedGroup.value" :banks="cuentasStore.banks" :can-create="canCreate" :highlighted-account-id="highlightedAccountId" @create="openCreate" />
    </div>
  </section>

  <CuentaBancariaCreateFormModal v-model="showCreateModal" variant="accounts" account-flow="destination" bank-country="pe" holder-type="natural" :locked-user-id="createForUserId ?? undefined" @created="onCreated" />
</template>
