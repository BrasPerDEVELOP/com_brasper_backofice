<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    size?: 'sm' | 'md'
    min?: string
    max?: string
    disabled?: boolean
    class?: string
  }>(),
  {
    size: 'md',
    class: ''
  }
)

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div
    :class="[
      'relative flex items-center rounded-lg border border-[#e5e7eb] bg-white transition',
      'focus-within:border-[#2563eb] focus-within:ring-1 focus-within:ring-[#2563eb]',
      size === 'sm' ? 'min-h-[36px]' : 'min-h-[40px]',
      props.class
    ]"
  >
    <div class="pointer-events-none absolute left-3 flex shrink-0 text-[#9ca3af]">
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
    <input
      :value="modelValue"
      type="date"
      :min="min"
      :max="max"
      :disabled="disabled"
      :class="[
        'w-full flex-1 border-0 bg-transparent text-[#374151] outline-none',
        'placeholder:text-[#9ca3af]',
        size === 'sm'
          ? 'pl-10 pr-3 py-2 text-xs'
          : 'pl-10 pr-4 py-2.5 text-sm'
      ]"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      type="button"
      class="mr-2 rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"
      title="Limpiar"
      @click="$emit('update:modelValue', '')"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* Mejora la apariencia del date picker nativo en navegadores compatibles */
input[type='date'] {
  color-scheme: light;
}

input[type='date']::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
  padding: 4px;
}

input[type='date']::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}
</style>
