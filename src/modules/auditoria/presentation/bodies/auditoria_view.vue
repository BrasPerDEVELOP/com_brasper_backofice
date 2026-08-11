<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { DataTable, PageHeader, type DataTableColumn } from '@interface/widgets'
import { useAuditStore } from '../controllers/use_audit_store'
import AuditFilters from '../components/AuditFilters.vue'
import AuditEventDetail from '../components/AuditEventDetail.vue'
import type { AuditEvent } from '../../domain/models'

const store = useAuditStore()
const eventColumns: DataTableColumn[] = [
  { key: 'created_at_label', label: 'Fecha', width: '170px' },
  { key: 'actor_label', label: 'Usuario' },
  { key: 'action', label: 'Acción' },
  { key: 'entity_label', label: 'Entidad' },
  { key: 'source', label: 'Origen' },
  { key: 'ip_address', label: 'IP' },
  { key: 'result_label', label: 'Resultado' }
]
const loginColumns: DataTableColumn[] = [
  { key: 'created_at_label', label: 'Fecha' }, { key: 'attempted_username', label: 'Usuario' },
  { key: 'source', label: 'Origen' }, { key: 'ip_address', label: 'IP' },
  { key: 'result_label', label: 'Resultado' }, { key: 'failure_reason', label: 'Motivo' }
]

const eventRows = computed(() => store.events.map((event) => ({
  ...event,
  created_at_label: new Date(event.created_at).toLocaleString('es-PE'),
  actor_label: event.actor_username ?? event.actor_user_id ?? 'Sistema/anónimo',
  entity_label: event.entity_id ? `${event.entity} · ${event.entity_id}` : event.entity,
  result_label: event.success ? `Exitoso · ${event.status_code ?? '-'}` : `Fallido · ${event.status_code ?? '-'}`
})))
const loginRows = computed(() => store.logins.map((event) => ({
  ...event,
  created_at_label: new Date(event.created_at).toLocaleString('es-PE'),
  result_label: event.success ? 'Exitoso' : 'Fallido'
})))

function openRow(row: Record<string, unknown>): void {
  if (store.activeTab === 'events') void store.openEvent(row as unknown as AuditEvent)
}

onMounted(() => void store.load())
</script>

<template>
  <section class="space-y-4 p-2">
    <PageHeader eyebrow="Seguridad" title="Auditoría" subtitle="Registro inmutable de accesos y cambios sensibles." />
    <div class="flex gap-2 border-b border-neutral-200">
      <button v-for="tab in (['events', 'logins'] as const)" :key="tab" type="button" :class="['border-b-2 px-4 py-2 text-sm font-semibold', store.activeTab === tab ? 'border-brasper-indigoStrong text-brasper-indigoStrong' : 'border-transparent text-neutral-500']" @click="store.selectTab(tab)">
        {{ tab === 'events' ? 'Cambios' : 'Inicios de sesión' }}
      </button>
    </div>
    <AuditFilters @apply="store.applyFilters" />
    <p v-if="store.error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ store.error }}</p>
    <DataTable v-if="store.activeTab === 'events'" :columns="eventColumns" :rows="eventRows" :loading="store.loading" empty-title="Sin eventos" empty-description="No hay cambios que coincidan con los filtros." @row-click="openRow" />
    <DataTable v-else :columns="loginColumns" :rows="loginRows" :loading="store.loading" empty-title="Sin accesos" empty-description="No hay accesos que coincidan con los filtros." />
    <footer class="flex items-center justify-between text-sm text-neutral-600">
      <span>{{ store.total }} registros · página {{ store.page }} de {{ store.totalPages }}</span>
      <div class="flex gap-2"><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="store.page <= 1" @click="store.previousPage">Anterior</button><button class="rounded-lg border px-3 py-2 disabled:opacity-40" :disabled="store.page >= store.totalPages" @click="store.nextPage">Siguiente</button></div>
    </footer>
    <AuditEventDetail :event="store.selectedEvent" @close="store.selectedEvent = null" />
  </section>
</template>
