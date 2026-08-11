<script setup lang="ts">
import { reactive } from 'vue'
import type { AuditFilters } from '../../domain/models'

const emit = defineEmits<{ apply: [filters: AuditFilters] }>()

const form = reactive({
  search: '',
  action: '',
  entity: '',
  source: '',
  ip_address: '',
  success: '',
  created_from: '',
  created_to: ''
})

function submit(): void {
  emit('apply', {
    search: form.search.trim() || undefined,
    action: form.action.trim() || undefined,
    entity: form.entity.trim() || undefined,
    source: form.source || undefined,
    ip_address: form.ip_address.trim() || undefined,
    success: form.success === '' ? undefined : form.success === 'true',
    created_from: form.created_from ? new Date(form.created_from).toISOString() : undefined,
    created_to: form.created_to ? new Date(form.created_to).toISOString() : undefined
  })
}

function clear(): void {
  Object.assign(form, { search: '', action: '', entity: '', source: '', ip_address: '', success: '', created_from: '', created_to: '' })
  submit()
}
</script>

<template>
  <form class="grid gap-3 rounded-2xl border border-[#d8e5fb] bg-white p-4 shadow-sm md:grid-cols-4" @submit.prevent="submit">
    <input v-model="form.search" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Usuario, entidad o request ID" />
    <input v-model="form.action" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Acción (ej. user.delete)" />
    <input v-model="form.entity" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Entidad" />
    <select v-model="form.source" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
      <option value="">Todos los orígenes</option>
      <option value="backoffice">Backoffice</option><option value="www">WWW</option><option value="ia">IA</option><option value="system">Sistema</option>
    </select>
    <input v-model="form.ip_address" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Dirección IP" />
    <select v-model="form.success" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
      <option value="">Todos los resultados</option><option value="true">Exitosos</option><option value="false">Fallidos</option>
    </select>
    <input v-model="form.created_from" type="datetime-local" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm" aria-label="Desde" />
    <input v-model="form.created_to" type="datetime-local" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm" aria-label="Hasta" />
    <div class="flex items-center justify-end gap-2">
      <button type="button" class="rounded-lg border border-neutral-300 px-3 py-2 text-sm" @click="clear">Limpiar</button>
      <button type="submit" class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
    </div>
  </form>
</template>
