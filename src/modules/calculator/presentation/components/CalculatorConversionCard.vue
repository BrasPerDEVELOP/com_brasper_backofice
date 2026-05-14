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
        <div
          v-if="showCalculationModeToggle"
          class="grid grid-cols-2 gap-2 rounded-xl bg-[#f3f6fb] p-1"
        >
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="
              calculatorStore.calculationMode === 'normal'
                ? 'bg-white text-brasper-indigoStrong shadow-sm'
                : 'text-[#6b7280] hover:text-brasper-indigoStrong'
            "
            @click="calculatorStore.setCalculationMode('normal')"
          >
            Calculadora normal
          </button>
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="
              calculatorStore.calculationMode === 'special'
                ? 'bg-white text-brasper-indigoStrong shadow-sm'
                : 'text-[#6b7280] hover:text-brasper-indigoStrong'
            "
            @click="calculatorStore.setCalculationMode('special')"
          >
            Calculadora especial
          </button>
        </div>

        <div
          v-if="showCoinCatalogReload"
          class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e8eef8] bg-[#fbfdff] px-3 py-2"
        >
          <span class="text-xs text-[#64748b]">Catálogo trial (tasas y comisiones)</span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-[#bcd7ff] bg-white px-3 py-1.5 text-xs font-semibold text-brasper-indigoStrong shadow-sm transition hover:bg-[#eef5ff] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="reloadingCatalog || calculatorStore.isLoading"
            @click="reloadCoinCatalog"
          >
            {{
              reloadingCatalog || calculatorStore.isLoading
                ? 'Actualizando…'
                : calculatorStore.calculationMode === 'special'
                  ? 'Recalcular'
                  : 'Actualizar tasas y comisiones'
            }}
          </button>
        </div>

        <div class="overflow-visible rounded-xl border border-gray-300 px-3 py-1.5 text-xl shadow-md">
          <label class="block pl-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tu envias</label>
          <div class="flex gap-0">
            <input
              v-model.number="displayedAmountSendLocal"
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
              v-model.number="displayedAmountReceiveLocal"
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
          <div
            v-if="
              showCalculationModeToggle &&
              calculatorStore.result.calculationMode === 'special' &&
              calculatorStore.specialDiscountError
            "
            class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          >
            {{ calculatorStore.specialDiscountError }}
          </div>
          <div
            v-if="
              showCalculationModeToggle &&
              calculatorStore.result.calculationMode === 'special'
            "
            class="flex justify-between text-sm"
          >
            <span class="text-gray-600">Recibe base</span>
            <span class="font-semibold text-gray-900">
              {{ formatCurrency(calculatorStore.result.specialBaseReceive, calculatorStore.currencyTo) }}
            </span>
          </div>
          <div
            v-if="
              showCalculationModeToggle &&
              calculatorStore.result.calculationMode === 'special'
            "
            class="flex justify-between text-sm"
          >
            <span class="text-gray-600">Recibe objetivo</span>
            <span class="font-semibold text-gray-900">
              {{ formatCurrency(calculatorStore.result.specialTargetReceive, calculatorStore.currencyTo) }}
            </span>
          </div>
          <div
            v-if="
              showCalculationModeToggle &&
              calculatorStore.calculationMode === 'normal' &&
              calculatorStore.result.calculationMode === 'normal'
            "
            class="flex justify-between text-sm"
          >
            <span class="text-gray-600">Mejora especial</span>
            <span class="text-sm font-semibold text-gray-500">No aplica (cotización normal)</span>
          </div>
          <div
            v-if="
              showCalculationModeToggle &&
              calculatorStore.result.calculationMode === 'special' &&
              calculatorStore.result.specialDiscountValid
            "
            class="flex justify-between text-sm"
          >
            <span class="text-gray-600">Descuento especial</span>
            <span class="font-semibold text-brasper-indigoStrong">
              {{ formatNumber(calculatorStore.result.specialDiscountPercentage) }}%
              ({{ formatCurrency(calculatorStore.result.specialDiscountAmount, calculatorStore.currencyFrom) }})
            </span>
          </div>
          <div
            v-if="showCalculationModeToggle"
            class="flex justify-between text-sm"
          >
            <span class="text-gray-600">Comisión base</span>
            <span class="font-semibold text-gray-900">
              {{ formatCurrency(calculatorStore.result.baseCommission, calculatorStore.currencyFrom) }}
            </span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Comision</span>
            <span class="font-semibold text-brasper-indigoStrong">
              {{
                formatCurrency(
                  displayedCommission,
                  calculatorStore.currencyFrom
                )
              }}
            </span>
          </div>
          <div
            v-if="hasAppliedCoupon"
            class="flex justify-between text-sm"
          >
            <span class="text-gray-600">Cupón {{ couponCode }}</span>
            <span class="font-semibold text-emerald-700">
              -{{ formatCurrency(couponDiscountAmount, calculatorStore.currencyFrom) }}
            </span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Total a pagar</span>
            <span class="font-semibold text-brasper-indigoStrong">
              {{ formatCurrency(displayedTotalToSend, calculatorStore.currencyFrom) }}
            </span>
          </div>
          <div
            class="flex justify-between text-sm"
          >
            <span class="text-gray-600">Tipo de cambio</span>
            <span class="font-semibold text-gray-900">
              1 {{ calculatorStore.currencyFrom.toUpperCase() }} = {{ formatRate(calculatorStore.result.rate) }}
              {{ calculatorStore.currencyTo.toUpperCase() }}
            </span>
          </div>
        </div>

        <template v-if="showSendCta">
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
        </template>
      </div>
    </template>

    <CalculatorWhatsappModal
      v-if="showSendCta"
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
import { computed, ref } from 'vue'
import CalculatorWhatsappModal from './CalculatorWhatsappModal.vue'
import { useCalculatorPage, type CalculatorPageVariant } from '../composables/use_calculator_page'

const props = withDefaults(
  defineProps<{
    variant?: CalculatorPageVariant
    /** Si es true con variant producción: datos desde API trial (`*-trial`), sin conmutador en UI. */
    useTrialCoinApi?: boolean
    /** Si es false, oculta el CTA de WhatsApp y el copy de garantía (p. ej. embed en backoffice). */
    showSendCta?: boolean
    /** Si es true, permite alternar entre calculadora normal y especial. */
    showCalculationModeToggle?: boolean
    /** Botón para volver a cargar tasas/comisiones desde la API (p. ej. cotización en modal). */
    showCoinCatalogReload?: boolean
    /** Descuento de cupón aplicado a la comisión actual. */
    couponDiscountPercentage?: number | null
    couponCode?: string | null
    couponAdjustedAmountSend?: number | null
    couponAdjustedAmountReceive?: number | null
  }>(),
  {
    variant: 'production',
    useTrialCoinApi: false,
    showSendCta: true,
    showCalculationModeToggle: false,
    showCoinCatalogReload: false,
    couponDiscountPercentage: null,
    couponCode: null,
    couponAdjustedAmountSend: null,
    couponAdjustedAmountReceive: null
  }
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
  formatNumber,
  formatRate,
  onAmountSendInput,
  onAmountReceiveInput,
  onFromChange,
  onToChange,
  handleButtonClick,
  setMessageLanguage,
  closeWhatsappModal,
  copyWhatsappMessage
} = useCalculatorPage(props.variant, { useTrialCoinApi: props.useTrialCoinApi })

const reloadingCatalog = ref(false)

async function reloadCoinCatalog() {
  if (reloadingCatalog.value || calculatorStore.isLoading) return
  reloadingCatalog.value = true
  try {
    await calculatorStore.loadData({ background: false })
    if (calculatorStore.inputMode === 'receive' && calculatorStore.amountReceive > 0) {
      calculatorStore.recalcFromReceive()
    } else if (calculatorStore.amountSend > 0) {
      calculatorStore.recalcFromSend()
    }
  } finally {
    reloadingCatalog.value = false
  }
}

const hasAppliedCoupon = computed(
  () =>
    Boolean(props.couponCode?.trim()) &&
    Number(props.couponDiscountPercentage ?? 0) > 0 &&
    Boolean(calculatorStore.result)
)

const baseDisplayedCommission = computed(() => {
  const res = calculatorStore.result
  if (!res) return 0
  return Number.isFinite(res.finalCommission) ? res.finalCommission : res.commission
})

const couponDiscountAmount = computed(() => {
  if (!hasAppliedCoupon.value) return 0
  const base = Math.max(0, baseDisplayedCommission.value)
  const discount = Math.round((base * (Number(props.couponDiscountPercentage) / 100) + Number.EPSILON) * 100) / 100
  return Math.min(discount, base)
})

const displayedCommission = computed(() =>
  Math.round((Math.max(0, baseDisplayedCommission.value - couponDiscountAmount.value) + Number.EPSILON) * 100) / 100
)

const displayedTotalToSend = computed(() => {
  const res = calculatorStore.result
  if (!res) return 0
  const amountSend = props.couponAdjustedAmountSend ?? res.amountSend
  return amountSend - displayedCommission.value
})

const displayedAmountSendLocal = computed({
  get: () => props.couponAdjustedAmountSend ?? amountSendLocal.value,
  set: (value: number) => {
    amountSendLocal.value = value
  }
})

const displayedAmountReceiveLocal = computed({
  get: () => props.couponAdjustedAmountReceive ?? amountReceiveLocal.value,
  set: (value: number) => {
    amountReceiveLocal.value = value
  }
})
</script>
