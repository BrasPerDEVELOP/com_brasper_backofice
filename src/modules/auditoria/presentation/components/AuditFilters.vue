<script setup lang="ts">
/**
 * Filtros de auditoría con divulgación progresiva.
 *
 * Ocho campos planos obligaban a leerlos todos para entender la vista, y la
 * mayoría (IP, acción exacta, entidad, rangos de fecha) solo hacen falta cuando
 * ya se investiga algo concreto. Arriba queda lo que se usa el 90% de las veces
 * —buscar, acotar el periodo, separar fallos— y el resto vive tras "Filtros
 * avanzados". La IP no se elimina: en una bitácora de seguridad es justo lo que
 * se necesita para rastrear un incidente, pero no es un filtro de entrada.
 */
import { computed, reactive, ref, watch } from 'vue'
import type { AuditFilters } from '../../domain/models'

const props = defineProps<{ tab: 'events' | 'logins' }>()
const emit = defineEmits<{ apply: [filters: AuditFilters] }>()

type PeriodKey = 'all' | 'today' | '7d' | '30d' | 'custom'

const PERIODS: { key: PeriodKey; label: string; days?: number }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'today', label: 'Hoy', days: 0 },
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 }
]

const SOURCES = [
  { value: '', label: 'Todos los orígenes' },
  { value: 'backoffice', label: 'Backoffice' },
  { value: 'www', label: 'Web pública' },
  { value: 'ia', label: 'IA' },
  { value: 'system', label: 'Sistema' }
]

const form = reactive({
  search: '',
  source: '',
  success: '',
  period: 'all' as PeriodKey,
  // Avanzados
  action: '',
  entity: '',
  ip_address: '',
  created_from: '',
  created_to: ''
})

const showAdvanced = ref(false)

/** Inicio del periodo elegido, o `undefined` si no acota. */
function periodStart(): string | undefined {
  const period = PERIODS.find((item) => item.key === form.period)
  if (!period || period.days === undefined) return undefined
  const from = new Date()
  if (period.days === 0) from.setHours(0, 0, 0, 0)
  else from.setDate(from.getDate() - period.days)
  return from.toISOString()
}

function build(): AuditFilters {
  const custom = form.period === 'custom'
  return {
    search: form.search.trim() || undefined,
    source: form.source || undefined,
    success: form.success === '' ? undefined : form.success === 'true',
    action: form.action.trim() || undefined,
    entity: form.entity.trim() || undefined,
    ip_address: form.ip_address.trim() || undefined,
    created_from: custom
      ? form.created_from
        ? new Date(form.created_from).toISOString()
        : undefined
      : periodStart(),
    created_to:
      custom && form.created_to ? new Date(form.created_to).toISOString() : undefined
  }
}

/** Los filtros se aplican solos: un botón "Filtrar" es un paso extra sin valor. */
let debounce: ReturnType<typeof setTimeout> | undefined
function apply(immediate = true): void {
  clearTimeout(debounce)
  if (immediate) emit('apply', build())
  else debounce = setTimeout(() => emit('apply', build()), 400)
}

function selectPeriod(key: PeriodKey): void {
  form.period = key
  apply()
}

watch(() => form.search, () => apply(false))
watch(
  () => [form.source, form.success, form.created_from, form.created_to],
  () => apply()
)
watch(() => [form.action, form.entity, form.ip_address], () => apply(false))

/** Chips de lo que está filtrando ahora mismo, para poder quitarlo de a uno. */
const activeChips = computed(() => {
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (form.search) {
    chips.push({ key: 'search', label: `"${form.search}"`, clear: () => (form.search = '') })
  }
  if (form.source) {
    const label = SOURCES.find((item) => item.value === form.source)?.label ?? form.source
    chips.push({ key: 'source', label, clear: () => (form.source = '') })
  }
  if (form.success !== '') {
    chips.push({
      key: 'success',
      label: form.success === 'true' ? 'Solo exitosos' : 'Solo fallidos',
      clear: () => (form.success = '')
    })
  }
  if (form.period !== 'all') {
    const label =
      form.period === 'custom'
        ? 'Rango personalizado'
        : (PERIODS.find((item) => item.key === form.period)?.label ?? '')
    chips.push({ key: 'period', label, clear: () => selectPeriod('all') })
  }
  if (form.action) chips.push({ key: 'action', label: `Acción: ${form.action}`, clear: () => (form.action = '') })
  if (form.entity) chips.push({ key: 'entity', label: `Entidad: ${form.entity}`, clear: () => (form.entity = '') })
  if (form.ip_address) chips.push({ key: 'ip', label: `IP: ${form.ip_address}`, clear: () => (form.ip_address = '') })
  return chips
})

const hasFilters = computed(() => activeChips.value.length > 0)

function clearAll(): void {
  Object.assign(form, {
    search: '',
    source: '',
    success: '',
    period: 'all' as PeriodKey,
    action: '',
    entity: '',
    ip_address: '',
    created_from: '',
    created_to: ''
  })
  apply()
}

defineExpose({ clearAll })

// Sin ancho: lo decide cada uso. Con `w-full` aquí, los selects en línea se
// estiraban y rompían la fila (dos utilidades de width compiten y gana la del
// CSS generado, no la del orden en el string).
const inputClass =
  'rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brasper-dark ' +
  'placeholder:text-neutral-400 transition focus:border-brasper-indigoStrong ' +
  'focus:outline-none focus:ring-2 focus:ring-brasper-indigoStrong/30'
</script>

<template>
  <section class="rounded-2xl border border-[#d8e5fb] bg-white p-4 shadow-sm">
    <!-- Fila esencial: buscar, periodo, resultado, origen -->
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="relative flex-1">
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" stroke-linecap="round" />
        </svg>
        <label class="sr-only" for="audit-search">Buscar en la auditoría</label>
        <input
          id="audit-search"
          v-model="form.search"
          type="search"
          :class="[inputClass, 'w-full pl-9']"
          :placeholder="props.tab === 'events'
            ? 'Buscar por usuario, entidad o request ID'
            : 'Buscar por usuario'"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:shrink-0">
        <!-- Periodo como atajos: cubre casi todas las consultas sin escribir fechas -->
        <div class="inline-flex rounded-lg border border-neutral-300 p-0.5" role="group" aria-label="Periodo">
          <button
            v-for="period in PERIODS" :key="period.key" type="button"
            :aria-pressed="form.period === period.key"
            :class="[
              'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition',
              'focus:outline-none focus:ring-2 focus:ring-brasper-indigoStrong/40',
              form.period === period.key
                ? 'bg-brasper-indigoStrong text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            ]"
            @click="selectPeriod(period.key)"
          >
            {{ period.label }}
          </button>
        </div>

        <label class="sr-only" for="audit-success">Resultado</label>
        <select id="audit-success" v-model="form.success" :class="[inputClass, 'cursor-pointer']">
          <option value="">Todos los resultados</option>
          <option value="true">Exitosos</option>
          <option value="false">Fallidos</option>
        </select>

        <label class="sr-only" for="audit-source">Origen</label>
        <select id="audit-source" v-model="form.source" :class="[inputClass, 'cursor-pointer']">
          <option v-for="source in SOURCES" :key="source.value" :value="source.value">
            {{ source.label }}
          </option>
        </select>

        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium
                 text-neutral-600 transition hover:bg-neutral-100 focus:outline-none
                 focus:ring-2 focus:ring-brasper-indigoStrong/40"
          :aria-expanded="showAdvanced"
          aria-controls="audit-advanced"
          @click="showAdvanced = !showAdvanced"
        >
          Filtros avanzados
          <svg
            class="h-4 w-4 transition-transform motion-reduce:transition-none"
            :class="showAdvanced && 'rotate-180'"
            viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"
          >
            <path d="m5 8 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Avanzados: solo cuando ya se investiga algo concreto -->
    <div v-show="showAdvanced" id="audit-advanced" class="mt-4 border-t border-neutral-100 pt-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div v-if="props.tab === 'events'">
          <label class="mb-1 block text-xs font-medium text-neutral-600" for="audit-action">Acción</label>
          <input id="audit-action" v-model="form.action" :class="[inputClass, 'w-full']" placeholder="user.delete" />
        </div>
        <div v-if="props.tab === 'events'">
          <label class="mb-1 block text-xs font-medium text-neutral-600" for="audit-entity">Entidad</label>
          <input id="audit-entity" v-model="form.entity" :class="[inputClass, 'w-full']" placeholder="transaction" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-neutral-600" for="audit-ip">Dirección IP</label>
          <input id="audit-ip" v-model="form.ip_address" :class="[inputClass, 'w-full']" placeholder="45.177.196.205" inputmode="numeric" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-neutral-600" for="audit-from">Desde</label>
          <input
            id="audit-from" v-model="form.created_from" type="datetime-local" :class="[inputClass, 'w-full']"
            @change="form.period = 'custom'"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-neutral-600" for="audit-to">Hasta</label>
          <input
            id="audit-to" v-model="form.created_to" type="datetime-local" :class="[inputClass, 'w-full']"
            @change="form.period = 'custom'"
          />
        </div>
      </div>
    </div>

    <!-- Lo que está filtrando ahora, quitable de a uno -->
    <div v-if="hasFilters" class="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
      <span class="text-xs font-medium text-neutral-500">Filtrando por</span>
      <button
        v-for="chip in activeChips" :key="chip.key" type="button"
        class="group inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#eef4ff] px-3 py-1
               text-xs font-semibold text-brasper-indigoStrong transition hover:bg-[#dfe9ff]
               focus:outline-none focus:ring-2 focus:ring-brasper-indigoStrong/40"
        :aria-label="`Quitar filtro ${chip.label}`"
        @click="chip.clear(); apply()"
      >
        {{ chip.label }}
        <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="m3 3 6 6M9 3l-6 6" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 underline-offset-2
               transition hover:text-brasper-dark hover:underline focus:outline-none
               focus:ring-2 focus:ring-brasper-indigoStrong/40"
        @click="clearAll"
      >
        Limpiar todo
      </button>
    </div>
  </section>
</template>
