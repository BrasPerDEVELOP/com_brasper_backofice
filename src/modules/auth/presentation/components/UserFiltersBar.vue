<script setup lang="ts">
import AppDropdown from '@/interface/components/AppDropdown.vue'

defineProps<{
  roleOptions: Array<{ value: string; label: string }>
  total: number
  /** Clientes dados de alta a la rápida que siguen sin email ni documento. */
  incompleteCount: number
}>()

const search = defineModel<string>('search', { required: true })
const role = defineModel<string>('role', { required: true })
const onlyIncomplete = defineModel<boolean>('onlyIncomplete', { required: true })
</script>

<template>
  <div class="mb-6 flex flex-wrap items-center gap-6">
    <div class="relative min-w-[220px] max-w-sm flex-1">
      <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      <input v-model="search" type="search" placeholder="Buscar por nombre, correo o documento" class="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white py-2.5 pl-10 pr-4 text-sm text-[#374151] placeholder-[#9ca3af] focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong" />
    </div>
    <div class="flex items-center gap-2">
      <label class="text-sm font-medium text-[#6b7280]">Rol</label>
      <AppDropdown v-model="role" :options="roleOptions" placeholder="Todos" :searchable="false" min-width="140px" />
    </div>
    <label
      v-if="incompleteCount > 0"
      class="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm font-medium text-[#9a3412]"
      title="Clientes dados de alta con solo el nombre: sin email ni documento"
    >
      <input v-model="onlyIncomplete" type="checkbox" class="h-4 w-4 rounded border-[#fdba74]" />
      Por completar ({{ incompleteCount }})
    </label>
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-[#6b7280]">Total</span>
      <span class="flex h-10 min-w-[4rem] items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm font-medium text-[#374151]">{{ total }}</span>
    </div>
  </div>
</template>
