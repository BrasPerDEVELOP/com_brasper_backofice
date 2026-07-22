<script setup lang="ts">
defineProps<{
  canCreate: boolean
  canExport: boolean
}>()

const emit = defineEmits<{
  create: []
  import: []
  export: []
}>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-medium text-[#1f2937]">Usuarios y cuentas</h1>
      <p class="mt-1 text-sm text-[#6b7280]">Selecciona un usuario para consultar sus datos y administrar sus cuentas bancarias.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button v-if="canCreate" type="button" class="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]" @click="emit('import')">Importar Excel</button>
      <button v-if="canExport" type="button" class="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]" @click="emit('export')">Exportar Excel</button>
      <button v-if="canCreate" type="button" class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark" @click="emit('create')">+ Crear usuario</button>
    </div>
  </header>
</template>
