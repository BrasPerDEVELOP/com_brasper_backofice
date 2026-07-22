<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { BankOption } from '../../infrastructure/adapters/banks_api_adapter'
import type { UserBankAccountGroup } from '../composables/use_user_bank_accounts'

const props = defineProps<{
  group: UserBankAccountGroup | null
  banks: BankOption[]
  canCreate: boolean
  highlightedAccountId?: string | null
}>()
const emit = defineEmits<{ create: [userId: string] }>()
const copiedValue = shallowRef('')

const bankById = computed(() => new Map(props.banks.map((bank) => [bank.id, bank])))
function bankLabel(id: string) {
  const bank = bankById.value.get(id)
  return bank ? `${bank.bank}${bank.currency ? ` (${bank.currency.toUpperCase()})` : ''}` : id
}
function holderLabel(account: UserBankAccountGroup['accounts'][number]) {
  return account.business_name || [account.holder_names, account.holder_surnames].filter(Boolean).join(' ') || '—'
}
async function copy(value: string | null | undefined) {
  if (!value) return
  await navigator.clipboard.writeText(value)
  copiedValue.value = value
  window.setTimeout(() => { copiedValue.value = '' }, 1500)
}
function formattedDate(value?: string) {
  if (!value) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<template>
  <aside class="rounded-xl border border-[#e5e7eb] bg-white p-5">
    <div v-if="group" class="space-y-5">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b border-[#e5e7eb] pb-4">
        <div><h2 class="text-lg font-semibold text-[#1f2937]">{{ group.user.name }}</h2><p class="text-sm text-[#6b7280]">{{ group.user.email }}</p><p v-if="group.primaryIdentification" class="mt-1 text-xs text-[#6b7280]">{{ group.primaryIdentification.document_type.toUpperCase() }} {{ group.primaryIdentification.document_number }}</p></div>
        <button v-if="canCreate" type="button" class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-semibold text-white" @click="emit('create', group.user.id)">+ Crear cuenta</button>
      </header>
      <div v-if="group.accounts.length" class="space-y-3">
        <article v-for="account in group.accounts" :key="account.id" class="rounded-xl border p-4 transition" :class="highlightedAccountId === account.id ? 'border-brasper-indigoStrong bg-[#eef2ff] ring-2 ring-brasper-indigoStrong/20' : 'border-[#e5e7eb]'">
          <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase text-brasper-indigoStrong">{{ account.bank_country === 'br' ? 'Brasil' : 'Perú' }} · {{ account.account_flow === 'origin' ? 'Origen' : 'Destino' }}</p><h3 class="mt-1 font-semibold text-[#1f2937]">{{ bankLabel(account.bank_id) }}</h3></div><span class="rounded bg-[#f3f4f6] px-2 py-1 text-xs text-[#4b5563]">{{ account.account_holder_type.toLowerCase().includes('legal') ? 'Jurídica' : 'Natural' }}</span></div>
          <dl class="mt-3 space-y-2 text-sm">
            <div v-if="account.account_number" class="flex items-center justify-between gap-2"><dt class="text-[#6b7280]">N.º cuenta</dt><dd><span class="font-mono">{{ account.account_number }}</span> <button class="ml-1 text-xs text-brasper-indigoStrong" type="button" @click="copy(account.account_number)">{{ copiedValue === account.account_number ? 'Copiado' : 'Copiar' }}</button></dd></div>
            <div v-if="account.cci_number" class="flex items-center justify-between gap-2"><dt class="text-[#6b7280]">CCI</dt><dd><span class="font-mono">{{ account.cci_number }}</span> <button class="ml-1 text-xs text-brasper-indigoStrong" type="button" @click="copy(account.cci_number)">Copiar</button></dd></div>
            <div v-if="account.pix_key" class="flex items-center justify-between gap-2"><dt class="text-[#6b7280]">PIX</dt><dd><span class="font-mono">{{ account.pix_key }}</span> <button class="ml-1 text-xs text-brasper-indigoStrong" type="button" @click="copy(account.pix_key)">Copiar</button></dd></div>
            <div class="flex items-center justify-between gap-2"><dt class="text-[#6b7280]">Titular</dt><dd class="text-right font-medium">{{ holderLabel(account) }}</dd></div>
          </dl>
          <p class="mt-3 border-t border-[#e5e7eb] pt-2 text-xs text-[#9ca3af]">Creada {{ formattedDate(account.created_at) }}</p>
        </article>
      </div>
      <div v-else class="rounded-xl border border-dashed border-[#d1d5db] px-5 py-12 text-center"><p class="font-medium text-[#374151]">Este cliente aún no tiene cuentas registradas.</p><button v-if="canCreate" type="button" class="mt-4 rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-semibold text-white" @click="emit('create', group.user.id)">Crear primera cuenta</button></div>
    </div>
    <div v-else class="py-16 text-center text-sm text-[#6b7280]">Selecciona un usuario para consultar sus cuentas.</div>
  </aside>
</template>
