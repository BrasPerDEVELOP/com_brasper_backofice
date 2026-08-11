<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DataTable, PageHeader, type DataTableColumn } from '@interface/widgets'
import { useAuditStore } from '../controllers/use_audit_store'
import AuditFilters from '../components/AuditFilters.vue'
import AuditEventDetail from '../components/AuditEventDetail.vue'
import type { AuditEvent } from '../../domain/models'

const store = useAuditStore()
const filtersRef = ref<InstanceType<typeof AuditFilters> | null>(null)

const TABS = [
  { key: 'events', label: 'Cambios' },
  { key: 'logins', label: 'Inicios de sesión' }
] as const

/**
 * La IP sale de la tabla de cambios: para un cambio importa quién y qué, y el
 * dato sigue disponible en el detalle. En inicios de sesión sí se queda, porque
 * ahí el origen de la conexión es justamente lo que se revisa.
 */
const eventColumns: DataTableColumn[] = [
  { key: 'created_at', label: 'Fecha', width: '150px' },
  { key: 'actor_label', label: 'Usuario' },
  { key: 'action', label: 'Acción' },
  { key: 'entity_label', label: 'Entidad' },
  { key: 'source', label: 'Origen', width: '120px' },
  { key: 'success', label: 'Resultado', width: '130px' },
  { key: 'detail', label: '', width: '90px', align: 'right' }
]

const loginColumns: DataTableColumn[] = [
  { key: 'created_at', label: 'Fecha', width: '150px' },
  { key: 'attempted_username', label: 'Usuario' },
  { key: 'source', label: 'Origen', width: '120px' },
  { key: 'ip_address', label: 'IP', width: '150px' },
  { key: 'success', label: 'Resultado', width: '130px' },
  { key: 'failure_reason', label: 'Motivo' }
]

const SOURCE_LABELS: Record<string, string> = {
  backoffice: 'Backoffice',
  www: 'Web pública',
  ia: 'IA',
  system: 'Sistema'
}

const absoluteDate = (value: string) => new Date(value).toLocaleString('es-PE')

/** Fecha relativa: en una bitácora importa más "hace 5 min" que el timestamp. */
function relativeDate(value: string): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return '—'
  const seconds = Math.round((then - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12], ['year', Infinity]
  ]
  let amount = seconds
  for (const [unit, step] of units) {
    if (Math.abs(amount) < step) {
      return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(Math.round(amount), unit)
    }
    amount /= step
  }
  return absoluteDate(value)
}

const eventRows = computed(() =>
  store.events.map((event) => ({
    ...event,
    actor_label: event.actor_username ?? event.actor_user_id ?? 'Sistema',
    entity_label: event.entity_id ? `${event.entity} · ${event.entity_id}` : event.entity
  }))
)

const loginRows = computed(() => store.logins.map((event) => ({ ...event })))

const rangeLabel = computed(() => {
  if (store.total === 0) return '0 registros'
  const rows = store.activeTab === 'events' ? store.events.length : store.logins.length
  const from = (store.page - 1) * 50 + 1
  return `${from}–${from + rows - 1} de ${store.total}`
})

const hasFilters = computed(() => Object.values(store.filters).some((value) => value !== undefined && value !== ''))

function openRow(row: Record<string, unknown>): void {
  if (store.activeTab === 'events') void store.openEvent(row as unknown as AuditEvent)
}

onMounted(() => void store.load())
</script>

<template>
  <section class="space-y-5 p-2">
    <PageHeader
      eyebrow="Seguridad"
      title="Auditoría"
      subtitle="Registro inmutable de accesos y cambios sensibles."
    />

    <!-- Pestañas con semántica real, no botones sueltos -->
    <div class="border-b border-neutral-200">
      <div class="flex gap-1" role="tablist" aria-label="Tipo de registro">
        <button
          v-for="tab in TABS" :key="tab.key" type="button" role="tab"
          :aria-selected="store.activeTab === tab.key"
          :class="[
            'cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brasper-indigoStrong/40',
            store.activeTab === tab.key
              ? 'border-brasper-indigoStrong text-brasper-indigoStrong'
              : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-brasper-dark'
          ]"
          @click="store.selectTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <AuditFilters ref="filtersRef" :tab="store.activeTab" @apply="store.applyFilters" />

    <!-- El error dice qué pasó y ofrece salida, en vez de solo pintarse en rojo -->
    <div
      v-if="store.error"
      class="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v4M10 13.5h.01" stroke-linecap="round" />
        </svg>
        <div>
          <p class="text-sm font-semibold text-red-800">No se pudo cargar la auditoría</p>
          <p class="mt-0.5 text-sm text-red-700">{{ store.error }}</p>
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 cursor-pointer rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold
               text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
        @click="store.load()"
      >
        Reintentar
      </button>
    </div>

    <DataTable
      v-if="store.activeTab === 'events'"
      :columns="eventColumns" :rows="eventRows" :loading="store.loading"
      :empty-title="hasFilters ? 'Sin coincidencias' : 'Sin cambios registrados'"
      :empty-description="hasFilters
        ? 'Ningún cambio coincide con los filtros aplicados.'
        : 'Los cambios sensibles aparecerán aquí en cuanto ocurran.'"
      @row-click="openRow"
    >
      <template #empty>
        <button
          v-if="hasFilters" type="button"
          class="mt-3 cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold
                 text-brasper-dark transition hover:bg-neutral-50 focus:outline-none
                 focus:ring-2 focus:ring-brasper-indigoStrong/40"
          @click="filtersRef?.clearAll()"
        >
          Limpiar filtros
        </button>
      </template>

      <template #cell-created_at="{ value }">
        <span class="whitespace-nowrap tabular-nums" :title="absoluteDate(String(value))">
          {{ relativeDate(String(value)) }}
        </span>
      </template>

      <template #cell-action="{ value }">
        <code class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-brasper-dark">{{ value }}</code>
      </template>

      <template #cell-entity_label="{ value }">
        <span class="block max-w-[26ch] truncate" :title="String(value)">{{ value }}</span>
      </template>

      <template #cell-source="{ value }">
        <span class="whitespace-nowrap rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-brasper-indigoStrong">
          {{ SOURCE_LABELS[String(value)] ?? value }}
        </span>
      </template>

      <!-- Icono + texto: el color no puede ser el único portador del significado -->
      <template #cell-success="{ row, value }">
        <span
          :class="[
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
            value ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          ]"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path v-if="value" d="m3.5 8.5 3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round" />
            <path v-else d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke-linecap="round" />
          </svg>
          {{ value ? 'Exitoso' : 'Fallido' }}
          <span v-if="row.status_code" class="font-normal opacity-70">{{ row.status_code }}</span>
        </span>
      </template>

      <!-- Botón real: la fila es clicable, pero eso no llega por teclado -->
      <template #cell-detail="{ row }">
        <button
          type="button"
          class="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brasper-indigoStrong
                 transition hover:bg-[#eef4ff] focus:outline-none focus:ring-2 focus:ring-brasper-indigoStrong/40"
          :aria-label="`Ver detalle de ${row.action}`"
          @click.stop="openRow(row)"
        >
          Ver
        </button>
      </template>
    </DataTable>

    <DataTable
      v-else
      :columns="loginColumns" :rows="loginRows" :loading="store.loading"
      :empty-title="hasFilters ? 'Sin coincidencias' : 'Sin accesos registrados'"
      :empty-description="hasFilters
        ? 'Ningún acceso coincide con los filtros aplicados.'
        : 'Los inicios de sesión aparecerán aquí en cuanto ocurran.'"
    >
      <template #cell-created_at="{ value }">
        <span class="whitespace-nowrap tabular-nums" :title="absoluteDate(String(value))">
          {{ relativeDate(String(value)) }}
        </span>
      </template>
      <template #cell-attempted_username="{ value }">
        <span>{{ value ?? '—' }}</span>
      </template>
      <template #cell-source="{ value }">
        <span class="whitespace-nowrap rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-brasper-indigoStrong">
          {{ SOURCE_LABELS[String(value)] ?? value }}
        </span>
      </template>
      <template #cell-ip_address="{ value }">
        <span class="font-mono text-xs tabular-nums">{{ value ?? '—' }}</span>
      </template>
      <template #cell-success="{ value }">
        <span
          :class="[
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
            value ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          ]"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path v-if="value" d="m3.5 8.5 3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round" />
            <path v-else d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke-linecap="round" />
          </svg>
          {{ value ? 'Exitoso' : 'Fallido' }}
        </span>
      </template>
      <template #cell-failure_reason="{ value }">
        <span class="text-neutral-500">{{ value ?? '—' }}</span>
      </template>
    </DataTable>

    <footer class="flex flex-col items-center justify-between gap-3 text-sm text-neutral-600 sm:flex-row">
      <span>Mostrando <span class="font-medium text-brasper-dark tabular-nums">{{ rangeLabel }}</span></span>
      <div class="flex items-center gap-2">
        <span class="tabular-nums">Página {{ store.page }} de {{ store.totalPages }}</span>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 font-medium transition
                 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40
                 focus:outline-none focus:ring-2 focus:ring-brasper-indigoStrong/40"
          :disabled="store.page <= 1" @click="store.previousPage"
        >
          Anterior
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 font-medium transition
                 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40
                 focus:outline-none focus:ring-2 focus:ring-brasper-indigoStrong/40"
          :disabled="store.page >= store.totalPages" @click="store.nextPage"
        >
          Siguiente
        </button>
      </div>
    </footer>

    <AuditEventDetail :event="store.selectedEvent" @close="store.selectedEvent = null" />
  </section>
</template>
