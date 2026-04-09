<template>
  <section class="rounded-2xl border border-gray-200 bg-white px-3.5 py-4 shadow-lg md:px-5 md:py-5">
    <div class="mb-5 flex items-center justify-center gap-2">
      <img src="/assets/logos/logo.png" alt="Logo" class="h-9 w-9 object-contain" />
      <h1 class="text-lg font-semibold text-gray-900 md:text-xl">Envia dinero al extranjero</h1>
      <span
        v-if="variant === 'demo'"
        class="rounded-full bg-brasper-cyanLight/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-brasper-indigoDark"
      >
        Demo
      </span>
    </div>

    <div
      v-if="calculatorStore.error"
      class="mb-4 rounded-xl bg-red-50 px-4 py-2 text-center text-xs font-medium text-red-600"
    >
      {{ calculatorStore.error }}
    </div>

    <div v-if="calculatorStore.isLoading" class="py-8 text-center text-sm text-gray-500">
      Cargando tasas y comisiones...
    </div>

    <template v-else>
      <div class="mt-3 space-y-3.5">
        <div class="overflow-visible rounded-xl border border-gray-300 px-3 py-1.5 text-xl shadow-md">
          <label class="block pl-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tu envias</label>
          <div class="flex gap-0">
            <input
              v-model.number="amountSendLocal"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              autocomplete="off"
              class="min-w-0 flex-1 pl-2 text-black font-semibold focus:outline-none"
              placeholder="1000"
              @input="onAmountSendInput"
            />
            <div class="relative w-[96px] shrink-0 sm:w-auto">
              <img
                :src="currencyFromFlagSrc"
                alt=""
                aria-hidden="true"
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full object-cover"
              />
              <select
                :value="calculatorStore.currencyFrom"
                class="w-full bg-white py-1.5 pl-10 pr-8 text-base font-light text-black focus:outline-none"
                @change="onFromChange"
              >
                <option v-for="code in CURRENCY_CODES" :key="code" :value="code">
                  {{ code.toUpperCase() }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="overflow-visible rounded-xl border border-gray-300 px-3 py-1.5 text-xl shadow-md">
          <label class="block pl-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
            >El destinatario recibe</label
          >
          <div class="flex gap-0">
            <input
              v-model.number="amountReceiveLocal"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              autocomplete="off"
              class="min-w-0 flex-1 pl-2 text-black font-semibold focus:outline-none"
              placeholder="0.00"
              @input="onAmountReceiveInput"
            />
            <div class="relative w-[96px] shrink-0 sm:w-auto">
              <img
                :src="currencyToFlagSrc"
                alt=""
                aria-hidden="true"
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full object-cover"
              />
              <select
                :value="calculatorStore.currencyTo"
                class="w-full bg-white py-1.5 pl-10 pr-8 text-base font-light text-black focus:outline-none"
                @change="onToChange"
              >
                <option v-for="code in calculatorStore.destinationOptions" :key="code" :value="code">
                  {{ code.toUpperCase() }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="calculatorStore.result" class="space-y-2 border-t border-gray-200 pt-4">
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Comision</span>
            <span class="font-semibold text-brasper-indigoStrong">
              {{ formatCurrency(calculatorStore.result.commission, calculatorStore.currencyFrom) }}
            </span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Total a pagar</span>
            <span class="font-semibold text-brasper-indigoStrong">
              {{ formatCurrency(calculatorStore.result.totalToSend, calculatorStore.currencyFrom) }}
            </span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Tipo de cambio</span>
            <span class="font-semibold text-gray-900">
              1 {{ calculatorStore.currencyFrom.toUpperCase() }} = {{ formatRate(calculatorStore.result.rate) }}
              {{ calculatorStore.currencyTo.toUpperCase() }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="relative z-[1] inline-flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-brasper-cyan px-5 py-2.5 text-sm font-bold text-white transition-colors duration-500 hover:bg-brasper-indigoStrong"
          @click="handleButtonClick"
        >
          Enviar dinero ahora
        </button>
        <p v-if="buttonFeedback" class="text-center text-xs font-medium text-red-600">
          {{ buttonFeedback }}
        </p>

        <p class="text-center text-xs text-gray-500">Garantizamos la tasa durante los proximos 15 minutos.</p>
      </div>
    </template>

    <CalculatorWhatsappModal
      :open="showWhatsappModal"
      :message="whatsappMessage"
      :language="messageLanguage"
      :copy-feedback="copyFeedback"
      @close="closeWhatsappModal"
      @copy="copyWhatsappMessage"
      @language="setMessageLanguage"
      @update:message="whatsappMessage = $event"
    />
  </section>
</template>

<script setup lang="ts">
import CalculatorWhatsappModal from './CalculatorWhatsappModal.vue'
import { useCalculatorPage, type CalculatorPageVariant } from '../composables/use_calculator_page'

const props = withDefaults(
  defineProps<{
    variant?: CalculatorPageVariant
  }>(),
  { variant: 'production' }
)

const {
  calculatorStore,
  CURRENCY_CODES,
  amountSendLocal,
  amountReceiveLocal,
  showWhatsappModal,
  whatsappMessage,
  copyFeedback,
  buttonFeedback,
  messageLanguage,
  currencyFromFlagSrc,
  currencyToFlagSrc,
  formatCurrency,
  formatRate,
  onAmountSendInput,
  onAmountReceiveInput,
  onFromChange,
  onToChange,
  handleButtonClick,
  setMessageLanguage,
  closeWhatsappModal,
  copyWhatsappMessage
} = useCalculatorPage(props.variant)
</script>
