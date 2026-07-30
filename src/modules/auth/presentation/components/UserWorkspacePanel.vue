<script setup lang="ts">
import { computed } from 'vue'
import type { UserListItem } from '../../infrastructure/adapters/users_management_api_adapter'
import { USER_ROLE_LABELS } from '../../domain/models'
import UserBankAccountsPanel from '@/modules/cuentas-bancarias/presentation/components/UserBankAccountsPanel.vue'
import type { BankOption } from '@/modules/cuentas-bancarias/infrastructure/adapters/banks_api_adapter'
import type { BankAccount } from '@/modules/cuentas-bancarias/domain/models'
import type { UserBankAccountGroup } from '@/modules/cuentas-bancarias/presentation/composables/use_user_bank_accounts'
import type { UserWorkspaceTab } from '../composables/use_user_workspace'

const props = defineProps<{
  user: UserListItem | null
  tab: UserWorkspaceTab
  accounts: BankAccount[]
  banks: BankOption[]
  accountsLoading: boolean
  accountsError?: string | null
  canViewAccounts: boolean
  canCreateAccount: boolean
  canUpdateAccount: boolean
  canDeleteAccount: boolean
  canUpdateUser: boolean
  highlightedAccountId?: string | null
}>()

const emit = defineEmits<{
  'update:tab': [tab: UserWorkspaceTab]
  editUser: [user: UserListItem]
  createAccount: [userId: string]
  editAccount: [account: BankAccount]
  deleteAccount: [account: BankAccount]
}>()

const isClient = computed(() => ['client', 'cliente'].includes((props.user?.role ?? '').toLowerCase()))
const accountGroup = computed<UserBankAccountGroup | null>(() => {
  if (!props.user || !isClient.value) return null
  const accounts = props.accounts.filter((account) => account.user_id === props.user?.id)
  return {
    user: {
      id: props.user.id,
      name: props.user.name,
      email: props.user.email,
      role: props.user.role,
      identifications: props.user.identifications
    },
    accounts,
    countries: Array.from(new Set(accounts.map((account) => account.bank_country.toUpperCase()))),
    hasAccounts: accounts.length > 0,
    primaryIdentification:
      props.user.identifications.find((item) => item.is_primary) ?? props.user.identifications[0] ?? null
  }
})

const primaryIdentification = computed(
  () => props.user?.identifications.find((item) => item.is_primary) ?? props.user?.identifications[0] ?? null
)
</script>

<template>
  <aside class="min-w-0 rounded-xl border border-[#e5e7eb] bg-white">
    <div v-if="user">
      <header class="border-b border-[#e5e7eb] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-lg font-semibold text-[#1f2937]">{{ user.name }}</h2>
            <p class="truncate text-sm text-[#6b7280]">{{ user.email }}</p>
          </div>
          <button v-if="canUpdateUser" type="button" class="rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-semibold text-[#4b5563] hover:bg-[#f9fafb]" @click="emit('editUser', user)">Editar usuario</button>
        </div>
        <nav class="mt-4 flex gap-1" aria-label="Detalle del usuario">
          <button type="button" class="rounded-lg px-3 py-2 text-sm font-medium" :class="tab === 'profile' ? 'bg-[#eef2ff] text-brasper-indigoStrong' : 'text-[#6b7280] hover:bg-[#f9fafb]'" @click="emit('update:tab', 'profile')">Datos</button>
          <button v-if="isClient && canViewAccounts" type="button" class="rounded-lg px-3 py-2 text-sm font-medium" :class="tab === 'accounts' ? 'bg-[#eef2ff] text-brasper-indigoStrong' : 'text-[#6b7280] hover:bg-[#f9fafb]'" @click="emit('update:tab', 'accounts')">Cuentas bancarias</button>
        </nav>
      </header>

      <div v-if="tab === 'profile' || !isClient || !canViewAccounts" class="space-y-4 p-5">
        <dl class="space-y-3 text-sm">
          <div><dt class="text-xs font-semibold uppercase text-[#9ca3af]">Rol</dt><dd class="mt-1 font-medium text-[#374151]">{{ USER_ROLE_LABELS[user.role as keyof typeof USER_ROLE_LABELS] ?? user.role ?? '—' }}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-[#9ca3af]">Identificación principal</dt><dd class="mt-1 font-medium text-[#374151]">{{ primaryIdentification ? `${primaryIdentification.document_type.toUpperCase()} ${primaryIdentification.document_number}` : 'No registrada' }}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-[#9ca3af]">Teléfono</dt><dd class="mt-1 font-medium text-[#374151]">{{ [user.code_phone, user.phone].filter(Boolean).join(' ') || 'No registrado' }}</dd></div>
        </dl>
        <p v-if="!isClient" class="rounded-lg bg-[#f9fafb] px-4 py-3 text-sm text-[#6b7280]">Las cuentas bancarias se administran únicamente para usuarios cliente.</p>
        <p v-else-if="!canViewAccounts" class="rounded-lg bg-[#f9fafb] px-4 py-3 text-sm text-[#6b7280]">No tienes permiso para consultar las cuentas bancarias de este cliente.</p>
      </div>

      <div v-else class="p-3">
        <p v-if="accountsError" class="mb-3 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">{{ accountsError }}</p>
        <div v-if="accountsLoading" class="py-16 text-center text-sm text-[#6b7280]">Cargando cuentas…</div>
        <UserBankAccountsPanel v-else :group="accountGroup" :banks="banks" :can-create="canCreateAccount" :can-update="canUpdateAccount" :can-delete="canDeleteAccount" :highlighted-account-id="highlightedAccountId" class="border-0 p-2 shadow-none" @create="emit('createAccount', $event)" @edit="emit('editAccount', $event)" @delete="emit('deleteAccount', $event)" />
      </div>
    </div>
    <div v-else class="px-6 py-20 text-center"><p class="font-medium text-[#374151]">Selecciona un usuario</p><p class="mt-1 text-sm text-[#6b7280]">Consulta sus datos y administra sus cuentas sin salir de esta pantalla.</p></div>
  </aside>
</template>
