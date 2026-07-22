<script setup lang="ts">
import type { UserBankAccountGroup } from '../composables/use_user_bank_accounts'

defineProps<{
  groups: UserBankAccountGroup[]
  selectedUserId: string | null
  canCreate: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  select: [userId: string]
  create: [userId: string]
}>()
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
    <table class="min-w-full divide-y divide-[#e5e7eb] text-sm">
      <thead class="bg-[#f9fafb] text-left text-xs uppercase tracking-wide text-[#6b7280]">
        <tr><th class="px-4 py-3">Cliente</th><th class="px-4 py-3">Documento</th><th class="px-4 py-3">Cuentas</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3 text-right">Acciones</th></tr>
      </thead>
      <tbody class="divide-y divide-[#e5e7eb]">
        <tr v-if="loading"><td colspan="5" class="px-4 py-12 text-center text-[#6b7280]">Cargando usuarios y cuentas…</td></tr>
        <tr
          v-for="group in groups"
          :key="group.user.id"
          class="cursor-pointer transition hover:bg-[#f9fafb]"
          :class="selectedUserId === group.user.id ? 'bg-[#eef2ff]' : ''"
          @click="emit('select', group.user.id)"
        >
          <td class="px-4 py-3"><p class="font-semibold text-[#1f2937]">{{ group.user.name }}</p><p class="text-xs text-[#6b7280]">{{ group.user.email }}</p></td>
          <td class="px-4 py-3 text-[#4b5563]">{{ group.primaryIdentification ? `${group.primaryIdentification.document_type.toUpperCase()} ${group.primaryIdentification.document_number}` : '—' }}</td>
          <td class="px-4 py-3"><span class="font-semibold">{{ group.accounts.length }}</span><span v-for="country in group.countries" :key="country" class="ml-1 rounded bg-[#eef2ff] px-1.5 py-0.5 text-xs text-brasper-indigoStrong">{{ country }}</span></td>
          <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="group.hasAccounts ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef3c7] text-[#92400e]'">{{ group.hasAccounts ? 'Con cuentas' : 'Sin cuentas' }}</span></td>
          <td class="px-4 py-3 text-right">
            <button v-if="canCreate && !group.hasAccounts" type="button" class="rounded-lg bg-brasper-indigoStrong px-3 py-2 text-xs font-semibold text-white" @click.stop="emit('create', group.user.id)">Crear cuenta</button>
            <button v-else type="button" class="rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-semibold text-[#4b5563]" @click.stop="emit('select', group.user.id)">Ver cuentas</button>
          </td>
        </tr>
        <tr v-if="!loading && groups.length === 0"><td colspan="5" class="px-4 py-12 text-center text-[#6b7280]">No hay usuarios que coincidan con la búsqueda.</td></tr>
      </tbody>
    </table>
  </div>
</template>
