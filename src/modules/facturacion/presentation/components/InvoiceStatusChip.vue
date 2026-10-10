<script setup lang="ts">
import { computed } from 'vue'
import { invoiceStatusMeta, isInvoicePending } from '../../domain/models'
import { INVOICE_TONE_CLASSES } from '../composables/billing_format'

const props = defineProps<{ status: string; size?: 'sm' | 'md' }>()

const meta = computed(() => invoiceStatusMeta(props.status))
const pending = computed(() => isInvoicePending(props.status))
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold"
    :class="[
      INVOICE_TONE_CLASSES[meta.tone],
      size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
    ]"
    :title="meta.hint"
  >
    <span
      v-if="pending"
      class="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
      aria-hidden="true"
    />
    {{ meta.label }}
  </span>
</template>
