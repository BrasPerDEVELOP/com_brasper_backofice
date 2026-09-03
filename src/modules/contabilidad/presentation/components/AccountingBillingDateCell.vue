<script setup lang="ts">
import { computed } from 'vue'
import AppDateInput from '@/interface/components/AppDateInput.vue'
import {
  apiDateTimeToFormValue,
  formDateTimeToApi
} from '../composables/accounting_datetime'

const props = defineProps<{
  billingDate?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  persist: [iso: string]
}>()

const localValue = computed(() => apiDateTimeToFormValue(props.billingDate))

function onChange(value: string) {
  if (props.disabled) return
  if (!value.trim()) return
  if (value === localValue.value) return
  const iso = formDateTimeToApi(value)
  if (!iso) return
  emit('persist', iso)
}
</script>

<template>
  <AppDateInput
    :model-value="localValue"
    size="sm"
    :disabled="disabled"
    :clearable="false"
    class="min-w-0 w-full"
    @update:model-value="onChange"
  />
</template>
