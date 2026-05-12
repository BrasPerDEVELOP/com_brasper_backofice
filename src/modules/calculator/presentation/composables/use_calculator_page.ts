import { ref, watch, computed, onMounted } from 'vue'
import {
  useCalculatorStore,
  useCalculatorDemoStore
} from '../controllers/use_calculator_store_controller'
import { CURRENCY_CODES, type CurrencyCode } from '../../domain/models'
import {
  CURRENCY_FLAG_SRC_BY_CODE,
  normalizeTwoDecimals,
  formatCurrency,
  formatNumber,
  formatRate
} from '../utils/calculator_format'
import { buildCalculatorWhatsappMessage } from '../utils/build_calculator_whatsapp_message'

const DEFAULT_INITIAL_AMOUNT = 1000

export type CalculatorPageVariant = 'production' | 'demo'

export interface UseCalculatorPageOptions {
  /** Si true en variante producción: usa siempre `coin/tax-rate-trial` y `coin/commission-trial` en el store principal. */
  useTrialCoinApi?: boolean
}

export function useCalculatorPage(
  variant: CalculatorPageVariant,
  options?: UseCalculatorPageOptions
) {
  const useTrialCoinApi = Boolean(options?.useTrialCoinApi)
  const calculatorStore =
    variant === 'demo' ? useCalculatorDemoStore() : useCalculatorStore()

  const amountSendLocal = ref(DEFAULT_INITIAL_AMOUNT)
  const amountReceiveLocal = ref(0)
  const showWhatsappModal = ref(false)
  const whatsappMessage = ref('')
  const copyFeedback = ref('')
  const buttonFeedback = ref('')
  const messageLanguage = ref<'es' | 'pt'>('es')

  const currencyFromFlagSrc = computed(
    () => CURRENCY_FLAG_SRC_BY_CODE[calculatorStore.currencyFrom] ?? '/assets/flags/usa.png'
  )
  const currencyToFlagSrc = computed(
    () => CURRENCY_FLAG_SRC_BY_CODE[calculatorStore.currencyTo] ?? '/assets/flags/usa.png'
  )

  watch(
    () => calculatorStore.amountSend,
    (v: number) => {
      amountSendLocal.value = normalizeTwoDecimals(v)
    },
    { immediate: true }
  )
  watch(
    () => calculatorStore.amountReceive,
    (v: number) => {
      amountReceiveLocal.value = normalizeTwoDecimals(v)
    },
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
    calculatorStore.recalcFromSend()
    amountReceiveLocal.value = normalizeTwoDecimals(calculatorStore.amountReceive)
  }

  function onToChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as CurrencyCode
    calculatorStore.setCurrencyTo(value)
    calculatorStore.recalcFromSend()
    amountReceiveLocal.value = normalizeTwoDecimals(calculatorStore.amountReceive)
  }

  async function switchEndpointMode(useDemo: boolean) {
    if (calculatorStore.demoMode === useDemo) return
    const send = normalizeTwoDecimals(amountSendLocal.value || calculatorStore.amountSend)
    const receive = normalizeTwoDecimals(amountReceiveLocal.value || calculatorStore.amountReceive)
    calculatorStore.setDemoMode(useDemo)
    await calculatorStore.loadData()
    calculatorStore.setAmountSend(send)
    if (calculatorStore.calculationMode === 'special') {
      calculatorStore.setAmountReceive(receive)
    } else {
      calculatorStore.recalcFromSend()
    }
    amountSendLocal.value = normalizeTwoDecimals(calculatorStore.amountSend)
    amountReceiveLocal.value = normalizeTwoDecimals(calculatorStore.amountReceive)
  }

  function handleButtonClick() {
    buttonFeedback.value = ''
    const effectiveAmount = normalizeTwoDecimals(
      Number(amountSendLocal.value) || calculatorStore.amountSend || DEFAULT_INITIAL_AMOUNT
    )

    if (effectiveAmount <= 0) {
      buttonFeedback.value = 'Ingresa un monto valido para generar el mensaje.'
      return
    }

    calculatorStore.setAmountSend(effectiveAmount)
    calculatorStore.recalcFromSend()
    amountSendLocal.value = effectiveAmount
    amountReceiveLocal.value = normalizeTwoDecimals(calculatorStore.amountReceive)

    if (!calculatorStore.result) {
      buttonFeedback.value = 'Aun no se puede generar el mensaje. Intenta nuevamente.'
      return
    }

    whatsappMessage.value = buildCalculatorWhatsappMessage(
      calculatorStore.result,
      calculatorStore.currencyFrom,
      calculatorStore.currencyTo,
      messageLanguage.value
    )
    showWhatsappModal.value = true
  }

  function setMessageLanguage(language: 'es' | 'pt') {
    messageLanguage.value = language
    if (!calculatorStore.result) return
    whatsappMessage.value = buildCalculatorWhatsappMessage(
      calculatorStore.result,
      calculatorStore.currencyFrom,
      calculatorStore.currencyTo,
      language
    )
    copyFeedback.value = ''
  }

  function closeWhatsappModal() {
    showWhatsappModal.value = false
    copyFeedback.value = ''
  }

  async function copyWhatsappMessage() {
    if (!whatsappMessage.value) return
    try {
      await navigator.clipboard.writeText(whatsappMessage.value)
      copyFeedback.value = 'Mensaje copiado'
      setTimeout(() => {
        copyFeedback.value = ''
      }, 1800)
    } catch {
      copyFeedback.value = 'No se pudo copiar'
    }
  }

  onMounted(async () => {
    if (variant === 'production') {
      calculatorStore.setDemoMode(useTrialCoinApi)
    }
    const expectTrialCoinCatalog = variant === 'demo' || useTrialCoinApi
    const catalogReady =
      calculatorStore.taxRates.length > 0 &&
      calculatorStore.commissions.length > 0 &&
      calculatorStore.lastCoinCatalogWasTrial === expectTrialCoinCatalog
    await calculatorStore.loadData({ background: catalogReady })
    if (!calculatorStore.amountSend || calculatorStore.amountSend <= 0) {
      calculatorStore.setAmountSend(DEFAULT_INITIAL_AMOUNT)
      calculatorStore.recalcFromSend()
      amountSendLocal.value = normalizeTwoDecimals(calculatorStore.amountSend)
      amountReceiveLocal.value = normalizeTwoDecimals(calculatorStore.amountReceive)
    }
  })

  return {
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
    switchEndpointMode,
    handleButtonClick,
    setMessageLanguage,
    closeWhatsappModal,
    copyWhatsappMessage
  }
}
