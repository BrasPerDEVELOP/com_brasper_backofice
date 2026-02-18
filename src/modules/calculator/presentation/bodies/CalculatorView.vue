<template>
  <div class="mx-auto max-w-4xl px-4 py-8 lg:py-10">
    <div class="mb-8 text-center">
      <div class="flex items-center justify-center gap-3">
        <h1 class="text-[28px] font-semibold text-[#232b4d] md:text-[34px]">
          Envía dinero al extranjero
        </h1>
        <span
          v-if="isDemo"
          class="rounded-full bg-[#e6ff00] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#232b4d]"
        >
          Demo
        </span>
      </div>
      <p class="mt-3 text-sm text-[#666] md:text-base">
        Transferencias internacionales rápidas, seguras y transparentes.
      </p>
    </div>

    <div class="rounded-3xl border border-[#d8e5fb] bg-white px-6 py-8 shadow-xl md:px-10 md:py-10">
      <div
        v-if="calculatorStore.error"
        class="mb-6 rounded-2xl bg-[#dc3545]/10 px-5 py-3 text-center text-sm font-medium text-[#dc3545]"
      >
        {{ calculatorStore.error }}
      </div>

      <div v-if="calculatorStore.isLoading" class="py-16 text-center text-[#666]">
        Cargando tasas y comisiones...
      </div>

      <template v-else>
        <div class="space-y-7">
          <div class="rounded-2xl border border-[#dbe7fb] bg-[#f9fbff] px-5 py-5 shadow-inner">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.25em] text-[#066ac9]">
                Tú envías
              </p>
              <span class="text-right text-[11px] font-medium uppercase tracking-[0.2em] text-[#666]">
                {{ CURRENCY_LABELS[calculatorStore.currencyFrom] }}
              </span>
            </div>
            <div class="mt-5 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <input
                v-model.number="amountSendLocal"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                placeholder="0.00"
                class="w-full flex-1 appearance-none rounded-2xl border border-[#d0def6] bg-white px-5 py-3.5 text-[26px] font-semibold text-[#232b4d] shadow-sm outline-none transition focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/30"
                @input="onAmountSendInput"
              />
              <div class="relative w-full sm:w-auto">
                <select
                  :value="calculatorStore.currencyFrom"
                  class="w-full appearance-none rounded-full border border-[#d0def6] bg-white px-5 py-2.5 pr-12 text-xs font-semibold uppercase tracking-[0.2em] text-[#232b4d] shadow-sm outline-none transition focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/30"
                  @change="onFromChange($event)"
                >
                  <option
                    v-for="code in CURRENCY_CODES"
                    :key="code"
                    :value="code"
                  >
                    {{ code.toUpperCase() }}
                  </option>
                </select>
                <span
                  class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#666]"
                >
                  ▼
                </span>
              </div>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-[#007bff]/15 text-[#007bff] shadow-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
              </svg>
            </div>
          </div>

          <div class="rounded-2xl border border-[#dbe7fb] bg-[#f9fbff] px-5 py-5 shadow-inner">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.25em] text-[#066ac9]">
                El destinatario recibe
              </p>
              <span class="text-right text-[11px] font-medium uppercase tracking-[0.2em] text-[#666]">
                {{ CURRENCY_LABELS[calculatorStore.currencyTo] }}
              </span>
            </div>
            <div class="mt-5 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <input
                v-model.number="amountReceiveLocal"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                placeholder="0.00"
                class="w-full flex-1 appearance-none rounded-2xl border border-[#d0def6] bg-white px-5 py-3.5 text-[26px] font-semibold text-[#232b4d] shadow-sm outline-none transition focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/30"
                @input="onAmountReceiveInput"
              />
              <div class="relative w-full sm:w-auto">
                <select
                  :value="calculatorStore.currencyTo"
                  class="w-full appearance-none rounded-full border border-[#d0def6] bg-white px-5 py-2.5 pr-12 text-xs font-semibold uppercase tracking-[0.2em] text-[#232b4d] shadow-sm outline-none transition focus:border-[#007bff] focus:ring-2 focus:ring-[#3b82f6]/30"
                  @change="onToChange($event)"
                >
                  <option
                    v-for="code in calculatorStore.destinationOptions"
                    :key="code"
                    :value="code"
                  >
                    {{ code.toUpperCase() }}
                  </option>
                </select>
                <span
                  class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#666]"
                >
                  ▼
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="calculatorStore.result"
            class="space-y-4 rounded-2xl border border-[#dbe7fb] bg-white px-5 py-5 shadow-sm"
          >
            <div class="flex items-center justify-between text-sm text-[#666]">
              <span class="font-medium text-[#555]">Comisión</span>
              <span class="text-base font-semibold text-[#10b981]">
                {{ formatCurrency(calculatorStore.result.commission, calculatorStore.currencyFrom) }}
              </span>
            </div>
            <div class="flex items-center justify-between text-sm text-[#666]">
              <span class="font-medium text-[#555]">Tipo de cambio</span>
              <span class="text-base font-semibold text-[#232b4d]">
                1 {{ calculatorStore.currencyFrom.toUpperCase() }} = {{ formatRate(calculatorStore.result.rate) }}
                {{ calculatorStore.currencyTo.toUpperCase() }}
              </span>
            </div>
            <div class="flex items-center justify-between text-sm text-[#666]">
              <span class="font-medium text-[#555]">Total a pagar</span>
              <span class="text-lg font-semibold text-[#007bff]">
                {{ formatCurrency(calculatorStore.result.totalToSend, calculatorStore.currencyFrom) }}
              </span>
            </div>
            <div class="rounded-2xl bg-[#f3f8ff] px-5 py-5 shadow-inner">
              <div class="flex items-center justify-between text-sm text-[#666]">
                <span>El destinatario recibe</span>
                <span class="text-lg font-semibold text-[#232b4d]">
                  {{ formatCurrency(calculatorStore.result.amountReceive, calculatorStore.currencyTo) }}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#007bff] via-[#007aff] to-[#3b82f6] px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-[#007bff]/30 transition hover:from-[#066ac9] hover:to-[#4484f3] focus:outline-none focus:ring-4 focus:ring-[#3b82f6]/30"
          >
            Enviar dinero ahora
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>

          <p class="text-center text-[11px] uppercase tracking-[0.3em] text-[#666]">
            Garantizamos la tasa durante los próximos 15 minutos
          </p>

          <div class="flex flex-wrap items-center justify-center gap-5 text-[11px] font-medium uppercase tracking-[0.3em] text-[#4A52D8]/70">
            <span>Transacción Segura</span>
            <span>SSL</span>
            <span>Regulación FCA</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCalculatorStore } from '../controllers/useCalculatorStore'
import { CURRENCY_CODES, CURRENCY_LABELS } from '../../domain/models'
import type { CurrencyCode } from '../../domain/models'

const route = useRoute()
const calculatorStore = useCalculatorStore()

const isDemo = computed(() => route.path.includes('calculator-demo'))

const amountSendLocal = ref(0)
const amountReceiveLocal = ref(0)

function normalizeTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

watch(
  () => calculatorStore.amountSend,
  (v) => { amountSendLocal.value = normalizeTwoDecimals(v) },
  { immediate: true }
)
watch(
  () => calculatorStore.amountReceive,
  (v) => { amountReceiveLocal.value = normalizeTwoDecimals(v) },
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

function onFromChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as CurrencyCode
  calculatorStore.setCurrencyFrom(value)
}

function onToChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as CurrencyCode
  calculatorStore.setCurrencyTo(value)
}

const currencyLocales: Record<CurrencyCode, string> = {
  pen: 'es-PE',
  usd: 'en-US',
  brl: 'pt-BR'
}

function formatCurrency(value: number, currency: CurrencyCode): string {
  const amount = Number.isFinite(value) ? value : 0
  const formatter = new Intl.NumberFormat(currencyLocales[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return formatter.format(amount)
}

function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value.toFixed(2)
}

onMounted(() => {
  calculatorStore.setDemoMode(isDemo.value)
  calculatorStore.loadData()
})

// Al cambiar de ruta (calculadora ↔ calculadora-demo) recargar con el modo correcto
watch(
  () => route.path,
  (path) => {
    const demo = path.includes('calculator-demo')
    if (calculatorStore.demoMode !== demo) {
      calculatorStore.setDemoMode(demo)
      calculatorStore.loadData()
    }
  }
)
</script>
