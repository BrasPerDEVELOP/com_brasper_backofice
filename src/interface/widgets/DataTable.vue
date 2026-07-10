<script setup lang="ts">
import { computed, ref } from 'vue'
import AppSpinner from './AppSpinner.vue'
import EmptyState from './EmptyState.vue'

/**
 * Tabla de datos genérica y reutilizable con la estética Brasper (mismos bordes,
 * header y filas hover que las tablas actuales). Sin cambios de diseño.
 *
 * Uso:
 *   <DataTable :columns="cols" :rows="items" row-key="id" sortable @row-click="open">
 *     <template #cell-status="{ value }"><Badge :status="value" /></template>
 *   </DataTable>
 *
 * Slots por columna: `#cell-<key>="{ row, value }"`. Slot `#empty` y `#actions`.
 */
export interface DataTableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  width?: string
}

type Row = Record<string, unknown>

const props = withDefaults(
  defineProps<{
    columns: DataTableColumn[]
    rows: Row[]
    rowKey?: string
    sortable?: boolean
    loading?: boolean
    loadingLabel?: string
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    rowKey: 'id',
    sortable: false,
    loading: false,
    loadingLabel: 'Cargando...',
    emptyTitle: 'Sin resultados',
    emptyDescription: ''
  }
)

const emit = defineEmits<{
  'row-click': [row: Row]
}>()

const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function isColumnSortable(col: DataTableColumn): boolean {
  return Boolean(props.sortable && (col.sortable ?? true))
}

function toggleSort(col: DataTableColumn): void {
  if (!isColumnSortable(col)) return
  if (sortKey.value === col.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = col.key
    sortDir.value = 'asc'
  }
}

const sortedRows = computed<Row[]>(() => {
  const key = sortKey.value
  if (!key) return props.rows
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av == null && bv == null) return 0
    if (av == null) return -dir
    if (bv == null) return dir
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), 'es') * dir
  })
})

function alignClass(align: DataTableColumn['align']): string {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

function rowKeyValue(row: Row, index: number): string {
  const v = row[props.rowKey]
  return v != null ? String(v) : String(index)
}
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-[#d8e5fb] bg-white shadow-lg shadow-brasper-indigoStrong/10">
    <AppSpinner v-if="loading" center size="lg" :label="loadingLabel" />

    <EmptyState v-else-if="rows.length === 0" :title="emptyTitle" :description="emptyDescription">
      <template v-if="$slots.empty" #default><slot name="empty" /></template>
    </EmptyState>

    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead class="bg-[#f8fafc]">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :style="col.width ? { width: col.width } : undefined"
              :class="[
                'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748b]',
                alignClass(col.align),
                isColumnSortable(col) ? 'cursor-pointer select-none hover:text-[#334155]' : ''
              ]"
              @click="toggleSort(col)"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <span v-if="isColumnSortable(col) && sortKey === col.key" aria-hidden="true">
                  {{ sortDir === 'asc' ? '▲' : '▼' }}
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in sortedRows"
            :key="rowKeyValue(row, index)"
            class="border-t border-[#e5e7eb] transition hover:bg-[#f9fafb]"
            @click="emit('row-click', row)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              :class="['px-4 py-3 text-[#374151]', alignClass(col.align)]"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] ?? '-' }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
