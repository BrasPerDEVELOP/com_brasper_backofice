<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch, nextTick } from 'vue'
import type { CreateBankAccountPayload } from '@/modules/cuentas-bancarias/infrastructure/adapters/cuentas_bancarias_repository'
import AppDropdown from './AppDropdown.vue'
import UsuarioCreateFormModal from './UsuarioCreateFormModal.vue'
import BancoCrudModal from './BancoCrudModal.vue'
import {
  bankMatchesCountry,
  digitsOnly,
  legalEntityDocumentLength,
  validateWizardStep2,
  type WizardCountry,
  type WizardFlow,
  type WizardHolder,
  type WizardVariant
} from './cuenta_bancaria_create_form_logic'

type DropdownOption = { value: string; label: string; country?: string; email?: string; doc?: string }

const props = defineProps<{
  accountFlow: WizardFlow
  bankCountry: WizardCountry
  holderType: WizardHolder
  lockedUserId?: string
  bankOptions: DropdownOption[]
  clientOptions: DropdownOption[]
  banksLoading: boolean
  clientsLoading: boolean
  lockedUserName: string
  lockedUserEmail?: string
  lockedUserDoc?: string
  error: string | null
  isCreating: boolean
  variant: WizardVariant
}>()
const emit = defineEmits<{
  submit: [payload: CreateBankAccountPayload]
  close: []
  validationError: [message: string]
  reloadBanks: []
  reloadClients: []
}>()

const step = shallowRef(1)
const formRoot = ref<HTMLFormElement | null>(null)
const showUsersModal = ref(false)
const showBanksModal = ref(false)
const fieldErrors = reactive<Record<string, string>>({})
const form = reactive({
  user_id: '' as string,
  bank_id: '',
  bank_country: props.bankCountry as WizardCountry,
  account_flow: props.accountFlow as WizardFlow,
  holder_type: props.holderType as WizardHolder,
  holder_names: '',
  holder_surnames: '',
  document_number: '',
  business_name: '',
  ruc_number: '',
  legal_representative_name: '',
  legal_representative_document: '',
  account_number: '',
  account_number_confirmation: '',
  cci_number: '',
  cci_number_confirmation: '',
  pix_key: '',
  pix_key_confirmation: '',
  pix_key_type: '',
  cpf: ''
})

watch(
  () => [props.bankCountry, props.accountFlow, props.holderType] as const,
  ([country, flow, holder]) => {
    form.bank_country = country
    form.account_flow = flow
    form.holder_type = holder
  },
  { immediate: true }
)

// Un banco elegido para un país no puede sobrevivir al cambio de país.
watch(
  () => form.bank_country,
  (country) => {
    if (!form.bank_id) return
    const selected = props.bankOptions.find((option) => option.value === form.bank_id)
    if (!selected || !bankMatchesCountry(selected.country, country)) form.bank_id = ''
  }
)

const filteredBankOptions = computed(() =>
  props.bankOptions.filter((bank) => bankMatchesCountry(bank.country, form.bank_country))
)
const isClientPickerMode = computed(() => !props.lockedUserId?.trim())
const selectedClientOption = computed(() =>
  props.clientOptions.find((option) => option.value === form.user_id)
)
const clientName = computed(() =>
  isClientPickerMode.value
    ? selectedClientOption.value?.label ?? 'Cliente por seleccionar'
    : props.lockedUserName
)
const clientSubtitle = computed(() => {
  const email = isClientPickerMode.value ? selectedClientOption.value?.email : props.lockedUserEmail
  const doc = isClientPickerMode.value ? selectedClientOption.value?.doc : props.lockedUserDoc
  return [email, doc].filter(Boolean).join(' · ')
})
const contextLabel = computed(() =>
  [
    form.bank_country === 'pe' ? 'Perú' : 'Brasil',
    form.account_flow === 'origin' ? 'Origen' : 'Destino',
    form.holder_type === 'natural' ? 'Persona natural' : 'Persona jurídica'
  ].join(' · ')
)
const legalDocMaxLength = computed(() => legalEntityDocumentLength(form.bank_country))

type NumericKey =
  | 'document_number'
  | 'ruc_number'
  | 'legal_representative_document'
  | 'account_number'
  | 'account_number_confirmation'
  | 'cci_number'
  | 'cci_number_confirmation'
  | 'cpf'

function onNumericInput(e: Event, key: NumericKey) {
  const target = e.target as HTMLInputElement
  const cleaned = digitsOnly(target.value)
  form[key] = cleaned
  target.value = cleaned
}

function clearErrors() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
}

function focusFirstError() {
  void nextTick(() => {
    formRoot.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}

function validateStep(targetStep: number): boolean {
  clearErrors()
  if (targetStep === 1) {
    if (!(props.lockedUserId?.trim() || form.user_id)) fieldErrors.user_id = 'Selecciona un cliente.'
  }
  if (targetStep === 2) {
    Object.assign(fieldErrors, validateWizardStep2(form, props.variant))
  }
  const ok = Object.keys(fieldErrors).length === 0
  if (!ok) focusFirstError()
  return ok
}

function next() {
  if (!validateStep(step.value)) return
  step.value = Math.min(3, step.value + 1)
}

function submitCreate() {
  if (!validateStep(2)) {
    step.value = 2
    emit('validationError', 'Revisa los datos marcados en el paso 2.')
    return
  }
  const userId = props.lockedUserId?.trim() || form.user_id
  if (!userId) {
    step.value = 1
    return
  }
  const toIntOrNull = (value: string): number | null => {
    const cleaned = digitsOnly(value)
    return cleaned ? Number(cleaned) : null
  }
  emit('submit', {
    user_id: userId,
    bank_id: form.bank_id,
    account_flow: form.account_flow,
    account_holder_type: form.holder_type === 'natural' ? 'naturalPerson' : 'legalEntity',
    bank_country: form.bank_country,
    holder_names: form.holder_names || null,
    holder_surnames: form.holder_surnames || null,
    document_number: toIntOrNull(form.document_number),
    business_name: form.business_name || null,
    ruc_number: toIntOrNull(form.ruc_number),
    legal_representative_name: form.legal_representative_name || null,
    legal_representative_document: toIntOrNull(form.legal_representative_document),
    account_number: toIntOrNull(form.account_number),
    account_number_confirmation: toIntOrNull(form.account_number_confirmation),
    cci_number: toIntOrNull(form.cci_number),
    cci_number_confirmation: toIntOrNull(form.cci_number_confirmation),
    pix_key: form.pix_key || null,
    pix_key_confirmation: form.pix_key_confirmation || null,
    pix_key_type: form.pix_key_type || null,
    cpf: toIntOrNull(form.cpf)
  })
}

const summaryHolder = computed(() => {
  if (form.holder_type === 'juridica') {
    const doc = form.ruc_number
      ? ` (${form.bank_country === 'pe' ? 'RUC' : 'CNPJ'} ${form.ruc_number})`
      : ''
    return (form.business_name || 'Titular sin registrar') + doc
  }
  const name = [form.holder_names, form.holder_surnames].filter(Boolean).join(' ')
  const doc =
    form.bank_country === 'pe'
      ? form.document_number && ` (DNI ${form.document_number})`
      : form.cpf && ` (CPF ${form.cpf})`
  return (name || 'Titular sin registrar') + (doc || '')
})
const summaryRows = computed(() => {
  const bank =
    filteredBankOptions.value.find((option) => option.value === form.bank_id)?.label ??
    'Banco sin seleccionar'
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Cliente', value: [clientName.value, clientSubtitle.value].filter(Boolean).join(' · ') },
    { label: 'Cuenta', value: contextLabel.value },
    { label: 'Banco', value: bank }
  ]
  if (form.bank_country === 'pe') {
    rows.push({ label: 'N.º de cuenta', value: form.account_number || '—' })
    if (form.cci_number) rows.push({ label: 'CCI', value: form.cci_number })
  } else {
    const type = form.pix_key_type ? ` (${form.pix_key_type.toUpperCase()})` : ''
    rows.push({ label: 'Clave PIX', value: (form.pix_key || '—') + type })
    if (form.cpf) rows.push({ label: 'CPF del titular', value: form.cpf })
  }
  rows.push({ label: 'Titular', value: summaryHolder.value })
  if (form.holder_type === 'juridica' && form.legal_representative_name) {
    rows.push({ label: 'Rep. legal', value: form.legal_representative_name })
  }
  return rows
})
</script>

<template>
  <form ref="formRoot" class="space-y-5 p-6" @submit.prevent="submitCreate">
    <div class="rounded-xl bg-[#eef2ff] px-4 py-3">
      <p class="text-xs font-semibold uppercase text-brasper-indigoStrong">Para</p>
      <p class="font-semibold text-[#1f2937]">{{ clientName }}</p>
      <p v-if="clientSubtitle" class="mt-0.5 text-xs text-[#4b5563]">{{ clientSubtitle }}</p>
    </div>
    <ol class="grid grid-cols-3 gap-2 text-center text-xs font-semibold"><li v-for="item in 3" :key="item" class="rounded-full px-2 py-2" :class="step === item ? 'bg-brasper-indigoStrong text-white' : step > item ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#f3f4f6] text-[#6b7280]'">{{ item }} · {{ item === 1 ? 'Tipo' : item === 2 ? 'Datos' : 'Confirmar' }}</li></ol>

    <section v-if="step === 1" class="space-y-5">
      <div v-if="isClientPickerMode">
        <label class="mb-1 block text-sm font-medium">Cliente</label>
        <div class="flex gap-2">
          <AppDropdown v-model="form.user_id" :options="clientOptions" :placeholder="clientsLoading ? 'Cargando…' : 'Seleccionar cliente'" searchable class="min-w-0 flex-1"/>
          <button type="button" class="shrink-0 rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm font-medium text-[#4b5563] transition hover:bg-[#f9fafb]" title="Crear cliente nuevo" @click="showUsersModal = true">+ Nuevo</button>
        </div>
        <p v-if="fieldErrors.user_id" class="mt-1 text-xs text-[#dc2626]">{{ fieldErrors.user_id }}</p>
      </div>
      <fieldset><legend class="mb-2 text-sm font-semibold">País del banco</legend><div class="grid grid-cols-2 gap-3"><label v-for="option in [{ value: 'pe', label: '🇵🇪 Perú' }, { value: 'br', label: '🇧🇷 Brasil' }]" :key="option.value" class="cursor-pointer rounded-xl border p-4 text-center" :class="form.bank_country === option.value ? 'border-brasper-indigoStrong bg-[#eef2ff]' : 'border-[#e5e7eb]'"><input v-model="form.bank_country" class="sr-only" type="radio" :value="option.value"/>{{ option.label }}</label></div></fieldset>
      <fieldset><legend class="mb-2 text-sm font-semibold">Uso de la cuenta</legend><div class="grid gap-3 sm:grid-cols-2"><label v-for="option in [{ value: 'origin', label: 'Origen', help: 'El cliente envía el dinero' }, { value: 'destination', label: 'Destino', help: 'El cliente recibe el dinero' }]" :key="option.value" class="cursor-pointer rounded-xl border p-4" :class="form.account_flow === option.value ? 'border-brasper-indigoStrong bg-[#eef2ff]' : 'border-[#e5e7eb]'"><input v-model="form.account_flow" class="mr-2" type="radio" :value="option.value"/><strong>{{ option.label }}</strong><p class="mt-1 text-xs text-[#6b7280]">{{ option.help }}</p></label></div></fieldset>
      <fieldset><legend class="mb-2 text-sm font-semibold">Titular</legend><div class="grid grid-cols-2 gap-3"><label v-for="option in [{ value: 'natural', label: 'Persona natural' }, { value: 'juridica', label: 'Persona jurídica' }]" :key="option.value" class="cursor-pointer rounded-xl border p-4 text-center" :class="form.holder_type === option.value ? 'border-brasper-indigoStrong bg-[#eef2ff]' : 'border-[#e5e7eb]'"><input v-model="form.holder_type" class="sr-only" type="radio" :value="option.value"/>{{ option.label }}</label></div></fieldset>
    </section>

    <section v-else-if="step === 2" class="space-y-5">
      <p class="rounded-lg bg-[#f0f9ff] px-3 py-2 text-sm font-medium text-[#0369a1]">{{ contextLabel }}</p>
      <div>
        <label class="mb-1 block text-sm font-medium">Banco *</label>
        <div class="flex gap-2">
          <AppDropdown v-model="form.bank_id" :options="filteredBankOptions" :placeholder="banksLoading ? 'Cargando…' : 'Seleccionar banco'" searchable class="min-w-0 flex-1"/>
          <button type="button" class="shrink-0 rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm font-medium text-[#4b5563] transition hover:bg-[#f9fafb]" title="Gestionar bancos" @click="showBanksModal = true">Gestionar</button>
        </div>
        <p v-if="fieldErrors.bank_id" class="mt-1 text-xs text-[#dc2626]">{{ fieldErrors.bank_id }}</p>
      </div>
      <div v-if="form.holder_type === 'natural'" class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm">Nombres<input v-model.trim="form.holder_names" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label>
        <label class="text-sm">Apellidos<input v-model.trim="form.holder_surnames" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label>
        <label class="text-sm">{{ form.bank_country === 'pe' ? 'DNI' : 'CPF' }}
          <input v-if="form.bank_country === 'pe'" :value="form.document_number" maxlength="8" inputmode="numeric" :aria-invalid="!!fieldErrors.document_number" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.document_number ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'document_number')"/>
          <input v-else :value="form.cpf" maxlength="11" inputmode="numeric" :aria-invalid="!!fieldErrors.cpf" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.cpf ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'cpf')"/>
          <span v-if="fieldErrors.document_number || fieldErrors.cpf" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.document_number || fieldErrors.cpf }}</span>
        </label>
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm sm:col-span-2">Razón social<input v-model.trim="form.business_name" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label>
        <label class="text-sm">{{ form.bank_country === 'pe' ? 'RUC (11 dígitos)' : 'CNPJ (14 dígitos)' }}
          <input :value="form.ruc_number" :maxlength="legalDocMaxLength" inputmode="numeric" :aria-invalid="!!fieldErrors.ruc_number" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.ruc_number ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'ruc_number')"/>
          <span v-if="fieldErrors.ruc_number" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.ruc_number }}</span>
        </label>
        <label class="text-sm">Representante legal<input v-model.trim="form.legal_representative_name" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label>
        <label class="text-sm">Documento del representante<input :value="form.legal_representative_document" maxlength="15" inputmode="numeric" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5" @input="onNumericInput($event, 'legal_representative_document')"/></label>
      </div>
      <div v-if="form.bank_country === 'pe'" class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm">Número de cuenta<span v-if="variant === 'accounts'"> *</span>
          <input :value="form.account_number" inputmode="numeric" :aria-invalid="!!fieldErrors.account_number" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.account_number ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'account_number')"/>
          <span v-if="fieldErrors.account_number" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.account_number }}</span>
        </label>
        <label class="text-sm">Confirmar número
          <input :value="form.account_number_confirmation" inputmode="numeric" :aria-invalid="!!fieldErrors.account_number_confirmation" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.account_number_confirmation ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @paste.prevent @input="onNumericInput($event, 'account_number_confirmation')"/>
          <span v-if="fieldErrors.account_number_confirmation" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.account_number_confirmation }}</span>
        </label>
        <label class="text-sm">CCI (20 dígitos)
          <input :value="form.cci_number" maxlength="20" inputmode="numeric" :aria-invalid="!!fieldErrors.cci_number" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.cci_number ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'cci_number')"/>
          <span v-if="fieldErrors.cci_number" class="text-xs text-[#dc2626]">{{ fieldErrors.cci_number }}</span>
        </label>
        <label class="text-sm">Confirmar CCI
          <input :value="form.cci_number_confirmation" maxlength="20" inputmode="numeric" :aria-invalid="!!fieldErrors.cci_number_confirmation" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.cci_number_confirmation ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @paste.prevent @input="onNumericInput($event, 'cci_number_confirmation')"/>
          <span v-if="fieldErrors.cci_number_confirmation" class="text-xs text-[#dc2626]">{{ fieldErrors.cci_number_confirmation }}</span>
        </label>
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm">Tipo de clave PIX *
          <select v-model="form.pix_key_type" :aria-invalid="!!fieldErrors.pix_key_type" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.pix_key_type ? 'border-[#dc2626]' : 'border-[#e5e7eb]'"><option value="">Seleccionar</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">Correo</option><option value="phone">Celular</option><option value="random">Aleatoria</option></select>
          <span v-if="fieldErrors.pix_key_type" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.pix_key_type }}</span>
        </label>
        <label class="text-sm">Clave PIX<span v-if="variant === 'accounts'"> *</span>
          <input v-model.trim="form.pix_key" :aria-invalid="!!fieldErrors.pix_key" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.pix_key ? 'border-[#dc2626]' : 'border-[#e5e7eb]'"/>
          <span v-if="fieldErrors.pix_key" class="text-xs text-[#dc2626]">{{ fieldErrors.pix_key }}</span>
        </label>
        <label class="text-sm">Confirmar clave PIX
          <input v-model.trim="form.pix_key_confirmation" :aria-invalid="!!fieldErrors.pix_key_confirmation" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.pix_key_confirmation ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @paste.prevent/>
          <span v-if="fieldErrors.pix_key_confirmation" class="text-xs text-[#dc2626]">{{ fieldErrors.pix_key_confirmation }}</span>
        </label>
      </div>
    </section>

    <section v-else class="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
      <h3 class="font-semibold text-[#1f2937]">Confirma los datos</h3>
      <dl class="mt-3 space-y-2 text-sm">
        <div v-for="row in summaryRows" :key="row.label" class="flex items-start justify-between gap-3">
          <dt class="shrink-0 text-[#6b7280]">{{ row.label }}</dt>
          <dd class="text-right font-medium text-[#1f2937]">{{ row.value }}</dd>
        </div>
      </dl>
    </section>

    <p v-if="error" class="rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">{{ error }}</p>
    <footer class="flex justify-between gap-3 border-t border-[#e5e7eb] pt-5"><button type="button" class="rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm" @click="step > 1 ? step-- : emit('close')">{{ step > 1 ? '← Atrás' : 'Cancelar' }}</button><button v-if="step < 3" type="button" class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white" @click="next">Continuar →</button><button v-else type="submit" class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" :disabled="isCreating">{{ isCreating ? 'Guardando…' : 'Crear cuenta' }}</button></footer>
  </form>

  <UsuarioCreateFormModal
    v-model="showUsersModal"
    :show-role-field="false"
    default-role="client"
    @created="
      (user) => {
        form.user_id = user.id
        emit('reloadClients')
      }
    "
  />
  <BancoCrudModal
    v-model="showBanksModal"
    :hint-country="form.bank_country"
    @saved="
      (payload) => {
        if (payload?.selectBankId) form.bank_id = payload.selectBankId
        if (!payload?.deletedBankId) emit('reloadBanks')
      }
    "
  />
</template>
