<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

export interface DropdownOption {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string | undefined
    options: DropdownOption[]
    placeholder?: string
    searchable?: boolean
    externalSearch?: boolean
    searchPlaceholder?: string
    size?: 'sm' | 'md'
    class?: string
    minWidth?: string
  }>(),
  {
    placeholder: 'Seleccionar',
    searchable: undefined,
    externalSearch: false,
    searchPlaceholder: 'Buscar...',
    size: 'md',
    class: '',
    minWidth: undefined
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const dropdownRef = ref<HTMLElement | null>(null)

const showSearch = computed(() => {
  if (props.searchable !== undefined) return props.searchable
  return props.options.length > 10
})

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.options
  const accountDigits = props.externalSearch && /^[\d\s./-]+$/.test(q)
    ? q.replace(/\D/g, '')
    : ''
  return props.options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) ||
      (Boolean(accountDigits) && o.label.replace(/\D/g, '').includes(accountDigits))
  )
})

/** Fila "placeholder" que emite '': solo si ninguna opción ya usa la misma etiqueta (evita "Todos" duplicado). */
const showPlaceholderRow = computed(() => {
  const ph = (props.placeholder ?? '').trim()
  if (!ph) return false
  const phLower = ph.toLowerCase()
  return !props.options.some(
    (o) => (o.label ?? '').trim().toLowerCase() === phLower
  )
})

const selectedValueStr = computed(() =>
  String(props.modelValue ?? '').trim(),
)

const selectedLabel = computed(() => {
  const val = selectedValueStr.value
  const opt = props.options.find((o) => String(o.value) === val)
  return opt?.label ?? props.placeholder
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    if (!props.externalSearch) searchQuery.value = ''
    nextTick(() => {
      const close = (e: MouseEvent) => {
        const el = dropdownRef.value
        if (el && !el.contains(e.target as Node)) {
          isOpen.value = false
          document.removeEventListener('click', close)
        }
      }
      setTimeout(() => document.addEventListener('click', close), 0)
    })
  }
}

function select(value: string) {
  emit('update:modelValue', value)
  isOpen.value = false
}

watch(
  () => props.modelValue,
  () => {
    isOpen.value = false
  }
)
</script>

<template>
  <div ref="dropdownRef" class="relative" :class="props.class">
    <div :class="externalSearch ? 'flex min-w-0 flex-col gap-2 sm:flex-row' : ''">
    <button
      type="button"
      :class="[
        'flex w-full items-center justify-between rounded-lg border bg-white text-left transition',
        externalSearch ? 'min-w-0 sm:flex-[3]' : '',
        props.size === 'sm'
          ? 'min-h-[32px] py-1.5 pl-2.5 pr-7 text-xs'
          : 'h-10 px-3 py-2.5 text-sm',
        isOpen ? 'border-brasper-indigoStrong ring-1 ring-brasper-indigoStrong' : 'border-[#e5e7eb] hover:border-[#9ca3af]'
      ]"
      :style="minWidth ? { minWidth } : undefined"
      @click="toggle"
    >
      <span
        :class="[externalSearch ? 'min-w-0 truncate' : '', selectedValueStr ? 'text-[#374151]' : 'text-[#9ca3af]']"
        :title="externalSearch ? selectedLabel : undefined"
      >
        {{ selectedLabel }}
      </span>
      <svg
        class="h-4 w-4 shrink-0 text-[#9ca3af] transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <input
      v-if="externalSearch"
      v-model="searchQuery"
      type="search"
      :placeholder="searchPlaceholder"
      :aria-label="searchPlaceholder"
      class="h-10 w-full min-w-0 rounded-lg border border-[#dce3ef] bg-white px-3 text-sm text-[#374151] outline-none focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/15 sm:flex-[2]"
      @focus="!isOpen && toggle()"
      @input="!isOpen && toggle()"
      @keydown.esc="isOpen = false"
      @keydown.enter.prevent
    />
    </div>
    <div
      v-if="isOpen"
      class="absolute left-0 top-full z-20 mt-1 w-full min-w-[200px] overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-lg"
      :style="minWidth ? { minWidth } : undefined"
    >
      <div v-if="showSearch && !externalSearch" class="border-b border-[#e5e7eb] p-2">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="`Buscar...`"
          class="w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm placeholder-[#9ca3af] focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
          @click.stop
        />
      </div>
      <div class="max-h-[200px] overflow-y-auto py-1">
        <button
          v-if="showPlaceholderRow"
          type="button"
          :class="[
            'flex w-full items-center px-3 py-2 text-left text-sm transition',
            !selectedValueStr ? 'bg-brasper-cyanLight/15 text-brasper-indigoStrong' : 'text-[#374151] hover:bg-[#f9fafb]'
          ]"
          @click.stop="select('')"
        >
          {{ placeholder }}
        </button>
        <button
          v-for="item in filteredOptions"
          :key="item.value"
          type="button"
          :class="[
            'flex w-full items-center px-3 py-2 text-left text-sm transition',
            selectedValueStr === String(item.value)
              ? 'bg-brasper-cyanLight/15 text-brasper-indigoStrong'
              : 'text-[#374151] hover:bg-[#f9fafb]'
          ]"
          @click.stop="select(item.value)"
        >
          {{ item.label }}
        </button>
        <p
          v-if="filteredOptions.length === 0"
          class="px-3 py-4 text-center text-sm text-[#9ca3af]"
        >
          Sin resultados
        </p>
      </div>
    </div>
  </div>
</template>
