<template>
  <div class="rounded-2xl border border-[#dbe7fb] bg-[#f9fbff] p-5">
    <div v-if="calculatorStore.error" class="mb-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
      {{ calculatorStore.error }}
    </div>

    <div v-if="calculatorStore.isLoading" class="py-12 text-center text-[#666]">
      Cargando tasas y comisiones...
    </div>

    <template v-else>
      <div class="space-y-5">
        <div class="rounded-xl border border-[#dbe7fb] bg-white px-4 py-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">Tú envías</p>
          <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              v-model.number="amountSendLocal"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              placeholder="0.00"
              class="flex-1 rounded-lg border border-[#d0def6] bg-white px-4 py-2.5 text-lg font-semibold text-[#232b4d] focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/30"
              @input="onAmountSendInput"
            />
            <AppDropdown
              v-model="currencyFrom"
              :options="currencyFromOptions"
              placeholder="PEN"
              :searchable="false"
            />
          </div>
        </div>

        <div class="flex justify-center">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-brasper-indigoStrong/15 text-brasper-indigoStrong">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
            </svg>
          </div>
        </div>

        <div class="rounded-xl border border-[#dbe7fb] bg-white px-4 py-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">El destinatario recibe</p>
          <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              v-model.number="amountReceiveLocal"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              placeholder="0.00"
              class="flex-1 rounded-lg border border-[#d0def6] bg-white px-4 py-2.5 text-lg font-semibold text-[#232b4d] focus:border-brasper-indigoStrong focus:ring-2 focus:ring-brasper-indigoStrong/30"
              @input="onAmountReceiveInput"
            />
            <AppDropdown
              v-model="currencyTo"
              :options="currencyToOptions"
              placeholder="USD"
              :searchable="false"
            />
          </div>
        </div>

        <div
          v-if="calculatorStore.result"
          class="space-y-3 rounded-xl border border-[#dbe7fb] bg-white px-4 py-4 shadow-sm"
        >
          <div class="flex items-center justify-between text-sm text-[#666]">
            <span>Comisión</span>
            <span class="font-semibold text-brasper-indigoStrong">
              {{ formatCurrency(calculatorStore.result.commission, calculatorStore.currencyFrom) }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm text-[#666]">
            <span>Tipo de cambio</span>
            <span class="font-semibold text-[#232b4d]">
              1 {{ calculatorStore.currencyFrom.toUpperCase() }} = {{ formatRate(calculatorStore.result.rate) }}
              {{ calculatorStore.currencyTo.toUpperCase() }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm text-[#666]">
            <span>Total a pagar</span>
            <span class="font-semibold text-brasper-indigoStrong">
              {{ formatCurrency(calculatorStore.result.totalToSend, calculatorStore.currencyFrom) }}
            </span>
          </div>
          <div class="rounded-lg bg-[#f3f8ff] px-4 py-3">
            <div class="flex items-center justify-between text-sm text-[#666]">
              <span>El destinatario recibe</span>
              <span class="font-semibold text-[#232b4d]">
                {{ formatCurrency(calculatorStore.result.amountReceive, calculatorStore.currencyTo) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useCalculatorStore } from '../controllers/use_calculator_store_controller'
import { CURRENCY_CODES, type CurrencyCode } from '../../domain/models'
import AppDropdown from '@/interface/components/AppDropdown.vue'

const calculatorStore = useCalculatorStore()

const currencyFromOptions = computed(() =>
  CURRENCY_CODES.map((code) => ({ value: code, label: code.toUpperCase() }))
)
const currencyToOptions = computed(() =>
  calculatorStore.destinationOptions.map((code) => ({ value: code, label: code.toUpperCase() }))
)
const currencyFrom = computed({
  get: () => calculatorStore.currencyFrom,
  set: (v: CurrencyCode) => calculatorStore.setCurrencyFrom(v)
})
const currencyTo = computed({
  get: () => calculatorStore.currencyTo,
  set: (v: CurrencyCode) => calculatorStore.setCurrencyTo(v)
})

const amountSendLocal = ref(0)
const amountReceiveLocal = ref(0)

function normalizeTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

watch(
  () => calculatorStore.amountSend,
  (v: number) => { amountSendLocal.value = normalizeTwoDecimals(v) },
  { immediate: true }
)
watch(
  () => calculatorStore.amountReceive,
  (v: number) => { amountReceiveLocal.value = normalizeTwoDecimals(v) },
  { immediate: true }
)

function onAmountSendInput() {
  const normalized = normalizeTwoDecimals(amountSendLocal.value || 0)
  amountSendLocal.value = normalized
  calculatorStore.setAmountSend(normalized)
  calculatorStore.recalcFromSend()
  amountReceiveLocal.value = normalizeTwoDecimals(calculatorStore.amountReceive)
}

function onAmountReceiveInput() {
  const normalized = normalizeTwoDecimals(amountReceiveLocal.value || 0)
  amountReceiveLocal.value = normalized
  calculatorStore.setAmountReceive(normalized)
  calculatorStore.recalcFromReceive()
  amountSendLocal.value = normalizeTwoDecimals(calculatorStore.amountSend)
}

const currencyLocales: Record<CurrencyCode, string> = {
  pen: 'es-PE',
  usd: 'en-US',
  brl: 'pt-BR'
}

function formatCurrency(value: number, currency: CurrencyCode): string {
  const amount = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat(currencyLocales[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value.toFixed(2)
}

onMounted(() => {
  calculatorStore.setDemoMode(false)
  calculatorStore.loadData()
})
</script>
