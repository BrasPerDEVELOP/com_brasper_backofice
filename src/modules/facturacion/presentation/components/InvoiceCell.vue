<script setup lang="ts">
/**
 * Celda "Comprobante SUNAT" de la tabla de Contabilidad.
 * Sin comprobante → botón Emitir; con comprobante → número + estado (abre el detalle).
 */
import type { Invoice } from '../../domain/models'
import { canIssueAgain } from '../../domain/models'
import InvoiceStatusChip from './InvoiceStatusChip.vue'

defineProps<{
  invoice: Invoice | null
  canIssue: boolean
  loading?: boolean
}>()

const emit = defineEmits<{ issue: []; open: [invoice: Invoice] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <button
      v-if="invoice"
      type="button"
      class="group inline-flex max-w-full flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 transition hover:bg-[#f5f8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brasper-indigoStrong"
      :title="`Ver ${invoice.documentTypeLabel} ${invoice.fullNumber}`"
      @click.stop="emit('open', invoice)"
    >
      <span
        class="max-w-full truncate font-mono text-[11px] font-medium text-[#374151] group-hover:text-brasper-indigoStrong"
      >
        {{ invoice.fullNumber }}
      </span>
      <InvoiceStatusChip :status="invoice.status" />
    </button>

    <button
      v-if="canIssue && canIssueAgain(invoice?.status)"
      type="button"
      class="inline-flex items-center gap-1 rounded-lg border border-[#bcd7ff] bg-[#eef5ff] px-2.5 py-1 text-[11px] font-semibold text-brasper-indigoStrong transition hover:bg-[#e2eeff]"
      title="Emitir boleta o factura electrónica por la comisión de esta operación"
      @click.stop="emit('issue')"
    >
      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
      {{ invoice ? 'Emitir otro' : 'Emitir' }}
    </button>

    <span v-if="!invoice && !canIssue" class="text-[#9ca3af]">
      {{ loading ? '…' : '—' }}
    </span>
  </div>
</template>
