<script setup lang="ts">
import type { AccountStatusFilter } from '../composables/use_user_bank_accounts'

defineProps<{
  counts: Record<AccountStatusFilter, number>
}>()

const search = defineModel<string>('search', { required: true })
const status = defineModel<AccountStatusFilter>('status', { required: true })

const filters: Array<{ value: AccountStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'with', label: 'Con cuentas' },
  { value: 'without', label: 'Sin cuentas' }
]
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl border border-[#e5e7eb] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
    <input
      v-model="search"
      type="search"
      class="min-h-11 w-full rounded-lg border border-[#e5e7eb] px-4 text-sm focus:border-brasper-indigoStrong focus:outline-none lg:max-w-md"
      placeholder="Nombre, correo o documento…"
    />
    <div class="flex flex-wrap gap-2">
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        class="min-h-10 rounded-full border px-4 text-sm font-medium transition"
        :class="status === filter.value ? 'border-brasper-indigoStrong bg-brasper-indigoStrong text-white' : 'border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb]'"
        @click="status = filter.value"
      >
        {{ filter.label }} ({{ counts[filter.value] }})
      </button>
    </div>
  </div>
</template>
