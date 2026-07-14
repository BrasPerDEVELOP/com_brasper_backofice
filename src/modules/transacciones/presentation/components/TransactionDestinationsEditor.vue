<script setup lang="ts">
import { computed } from 'vue'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import { blockNumberInputWheel } from '@/interface/helpers/block_number_input_wheel'
import {
  emptyTransactionDestination,
  validateTransactionDestinations,
  type TransactionDestinationDraft
} from '../composables/use_transaction_destinations'

interface DestinationOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  options: DestinationOption[]
  expectedTotal: number
  currency?: string
  loading?: boolean
}>(), {
  currency: '',
  loading: false
})

const emit = defineEmits<{ createAccount: [] }>()
const destinations = defineModel<TransactionDestinationDraft[]>({ required: true })

const validation = computed(() =>
  validateTransactionDestinations(destinations.value, props.expectedTotal)
)

function optionsForRow(index: number): DestinationOption[] {
  const current = destinations.value[index]?.bank_account_id
  const selectedElsewhere = new Set(
    destinations.value
      .filter((_, itemIndex) => itemIndex !== index)
      .map((item) => item.bank_account_id)
      .filter(Boolean)
  )
  return props.options.filter(
    (option) => option.value === current || !selectedElsewhere.has(option.value)
  )
}

function updateRow(index: number, patch: Partial<TransactionDestinationDraft>) {
  destinations.value = destinations.value.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : item
  )
}

function updateAmount(index: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  updateRow(index, { amount: raw === '' ? null : Number(raw) })
}

function addDestination() {
  destinations.value = [...destinations.value, emptyTransactionDestination()]
}

function removeDestination(index: number) {
  if (destinations.value.length <= 1) return
  destinations.value = destinations.value.filter((_, itemIndex) => itemIndex !== index)
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(destination, index) in destinations"
      :key="`${index}-${destination.bank_account_id}`"
      class="grid gap-2 rounded-xl border border-[#dce3ef] bg-[#fbfdff] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(140px,190px)_auto] sm:items-end"
    >
      <div class="space-y-1.5">
        <label class="block text-xs font-medium text-[#6b7280]">
          Cuenta {{ index + 1 }}
        </label>
        <AppDropdown
          :model-value="destination.bank_account_id"
          :options="optionsForRow(index)"
          placeholder="Seleccionar cuenta"
          :searchable="options.length > 5"
          @update:model-value="updateRow(index, { bank_account_id: $event })"
        />
      </div>
      <div class="space-y-1.5">
        <label class="block text-xs font-medium text-[#6b7280]">
          Monto <template v-if="currency">({{ currency }})</template>
        </label>
        <input
          :value="destination.amount ?? ''"
          type="number"
          min="0.01"
          step="0.01"
          class="h-10 w-full rounded-lg border border-[#dce3ef] bg-white px-3 text-sm text-[#374151] outline-none transition focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/15"
          placeholder="0,00"
          @input="updateAmount(index, $event)"
          @wheel="blockNumberInputWheel"
        />
      </div>
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#9ca3af] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        title="Quitar cuenta"
        :disabled="destinations.length <= 1"
        @click="removeDestination(index)"
      >
        <span aria-hidden="true">×</span>
        <span class="sr-only">Quitar cuenta</span>
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border border-brasper-indigoStrong/25 bg-white px-3 py-2 text-xs font-semibold text-brasper-indigoStrong transition hover:bg-brasper-cyanLight/15"
        @click="addDestination"
      >
        + Agregar otra cuenta
      </button>
      <button
        type="button"
        class="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#6b7280] transition hover:bg-[#f9fafb]"
        @click="emit('createAccount')"
      >
        + Crear cuenta bancaria
      </button>
    </div>

    <p v-if="loading" class="text-xs text-[#6b7280]">Cargando cuentas del cliente…</p>

    <div class="grid gap-1 rounded-lg bg-[#f5f7fb] px-3 py-2 text-xs text-[#4b5563] sm:grid-cols-2">
      <span>Total asignado: <strong>{{ formatMoney(validation.total) }} {{ currency }}</strong></span>
      <span>
        {{ validation.difference >= 0 ? 'Monto pendiente' : 'Monto excedido' }}:
        <strong>{{ formatMoney(Math.abs(validation.difference)) }} {{ currency }}</strong>
      </span>
    </div>
    <p v-if="validation.error" class="text-xs font-medium text-amber-700">
      {{ validation.error }}
    </p>
  </div>
</template>
