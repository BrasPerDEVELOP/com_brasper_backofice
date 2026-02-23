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
    size?: 'sm' | 'md'
    class?: string
    minWidth?: string
  }>(),
  {
    placeholder: 'Seleccionar',
    searchable: undefined,
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
  return props.options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
  )
})

const selectedLabel = computed(() => {
  const val = props.modelValue ?? ''
  const opt = props.options.find((o) => o.value === val)
  return opt?.label ?? props.placeholder
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
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
    <button
      type="button"
      :class="[
        'flex w-full items-center justify-between rounded-lg border bg-white text-left transition',
        props.size === 'sm'
          ? 'min-h-[32px] py-1.5 pl-2.5 pr-7 text-xs'
          : 'h-10 px-3 py-2.5 text-sm',
        isOpen ? 'border-[#2563eb] ring-1 ring-[#2563eb]' : 'border-[#e5e7eb] hover:border-[#9ca3af]'
      ]"
      :style="minWidth ? { minWidth } : undefined"
      @click="toggle"
    >
      <span :class="props.modelValue ? 'text-[#374151]' : 'text-[#9ca3af]'">
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
    <div
      v-if="isOpen"
      class="absolute left-0 top-full z-20 mt-1 w-full min-w-[200px] overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-lg"
      :style="minWidth ? { minWidth } : undefined"
    >
      <div v-if="showSearch" class="border-b border-[#e5e7eb] p-2">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="`Buscar...`"
          class="w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm placeholder-[#9ca3af] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
          @click.stop
        />
      </div>
      <div class="max-h-[200px] overflow-y-auto py-1">
        <button
          type="button"
          :class="[
            'flex w-full items-center px-3 py-2 text-left text-sm transition',
            !(props.modelValue ?? '') ? 'bg-[#eff6ff] text-[#2563eb]' : 'text-[#374151] hover:bg-[#f9fafb]'
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
            (props.modelValue ?? '') === item.value
              ? 'bg-[#eff6ff] text-[#2563eb]'
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
