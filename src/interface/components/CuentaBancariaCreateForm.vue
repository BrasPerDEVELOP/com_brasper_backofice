<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import type { CreateBankAccountPayload } from '@/modules/cuentas-bancarias/infrastructure/adapters/cuentas_bancarias_repository'
import AppDropdown from './AppDropdown.vue'

type Country = 'pe' | 'br'
type Flow = 'origin' | 'destination'
type Holder = 'natural' | 'juridica'
type Variant = 'accounts' | 'transaction'
type DropdownOption = { value: string; label: string; country?: string }

const props = defineProps<{
  accountFlow: Flow
  bankCountry: Country
  holderType: Holder
  lockedUserId?: string
  bankOptions: DropdownOption[]
  clientOptions: DropdownOption[]
  banksLoading: boolean
  clientsLoading: boolean
  lockedUserName: string
  error: string | null
  isCreating: boolean
  variant: Variant
}>()
const emit = defineEmits<{
  submit: [payload: CreateBankAccountPayload]
  close: []
  validationError: [message: string]
}>()

const step = shallowRef(1)
const fieldErrors = reactive<Record<string, string>>({})
const form = reactive({
  user_id: '', bank_id: '', bank_country: props.bankCountry as Country,
  account_flow: props.accountFlow as Flow, holder_type: props.holderType as Holder,
  holder_names: '', holder_surnames: '', document_number: '', business_name: '', ruc_number: '',
  legal_representative_name: '', legal_representative_document: '', account_number: '',
  account_number_confirmation: '', cci_number: '', cci_number_confirmation: '', pix_key: '',
  pix_key_confirmation: '', pix_key_type: '', cpf: ''
})

watch(() => [props.bankCountry, props.accountFlow, props.holderType] as const, ([country, flow, holder]) => {
  form.bank_country = country
  form.account_flow = flow
  form.holder_type = holder
}, { immediate: true })

const filteredBankOptions = computed(() => props.bankOptions.filter((bank) =>
  !bank.country || bank.country.toLowerCase() === form.bank_country
))
const isClientPickerMode = computed(() => !props.lockedUserId?.trim())
const selectedClientLabel = computed(() => props.lockedUserName || props.clientOptions.find((option) => option.value === form.user_id)?.label || 'Cliente por seleccionar')
const requiresIdentifier = computed(() => props.variant === 'accounts')
const identifierLabel = computed(() => form.bank_country === 'pe' ? 'número de cuenta' : 'clave PIX')

function digits(value: string) { return value.replace(/\D/g, '') }
function toIntOrNull(value: string): number | null {
  const cleaned = digits(value)
  return cleaned ? Number(cleaned) : null
}
function clearErrors() { Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]) }
function validateStep(targetStep: number): boolean {
  clearErrors()
  if (targetStep === 1) {
    if (!(props.lockedUserId?.trim() || form.user_id)) fieldErrors.user_id = 'Selecciona un cliente.'
    return Object.keys(fieldErrors).length === 0
  }
  if (targetStep === 2) {
    if (!form.bank_id) fieldErrors.bank_id = 'Selecciona un banco.'
    if (form.bank_country === 'pe') {
      if (requiresIdentifier.value && !form.account_number) fieldErrors.account_number = 'El número de cuenta es obligatorio.'
      if (form.account_number && form.account_number !== form.account_number_confirmation) fieldErrors.account_number_confirmation = 'La confirmación no coincide.'
      if (form.cci_number && digits(form.cci_number).length !== 20) fieldErrors.cci_number = 'El CCI debe tener 20 dígitos.'
      if (form.cci_number && form.cci_number !== form.cci_number_confirmation) fieldErrors.cci_number_confirmation = 'La confirmación no coincide.'
    } else {
      if (requiresIdentifier.value && !form.pix_key.trim()) fieldErrors.pix_key = 'La clave PIX es obligatoria.'
      if (form.pix_key && form.pix_key !== form.pix_key_confirmation) fieldErrors.pix_key_confirmation = 'La confirmación no coincide.'
      if (form.cpf && digits(form.cpf).length !== 11) fieldErrors.cpf = 'El CPF debe tener 11 dígitos.'
    }
    if (form.holder_type === 'natural' && form.bank_country === 'pe' && form.document_number && digits(form.document_number).length !== 8) fieldErrors.document_number = 'El DNI debe tener 8 dígitos.'
    if (form.holder_type === 'juridica' && form.ruc_number && digits(form.ruc_number).length !== 11) fieldErrors.ruc_number = 'El RUC/CNPJ debe tener 11 dígitos.'
    return Object.keys(fieldErrors).length === 0
  }
  return true
}
function next() {
  if (!validateStep(step.value)) return
  step.value = Math.min(3, step.value + 1)
}
function submitCreate() {
  if (!validateStep(2)) { step.value = 2; emit('validationError', `Revisa los datos de la cuenta: ${identifierLabel.value}.`); return }
  const userId = props.lockedUserId?.trim() || form.user_id
  if (!userId) { step.value = 1; return }
  emit('submit', {
    user_id: userId, bank_id: form.bank_id, account_flow: form.account_flow,
    account_holder_type: form.holder_type === 'natural' ? 'naturalPerson' : 'legalEntity',
    bank_country: form.bank_country, holder_names: form.holder_names || null,
    holder_surnames: form.holder_surnames || null, document_number: toIntOrNull(form.document_number),
    business_name: form.business_name || null, ruc_number: toIntOrNull(form.ruc_number),
    legal_representative_name: form.legal_representative_name || null,
    legal_representative_document: toIntOrNull(form.legal_representative_document),
    account_number: toIntOrNull(form.account_number), account_number_confirmation: toIntOrNull(form.account_number_confirmation),
    cci_number: toIntOrNull(form.cci_number), cci_number_confirmation: toIntOrNull(form.cci_number_confirmation),
    pix_key: form.pix_key || null, pix_key_confirmation: form.pix_key_confirmation || null,
    pix_key_type: form.pix_key_type || null, cpf: toIntOrNull(form.cpf)
  })
}
const summary = computed(() => {
  const bank = filteredBankOptions.value.find((option) => option.value === form.bank_id)?.label ?? 'Banco sin seleccionar'
  const id = form.bank_country === 'pe' ? `N.º ${form.account_number || '—'}` : `PIX ${form.pix_key || '—'}`
  return `Vas a crear una cuenta ${form.account_flow === 'origin' ? 'Origen' : 'Destino'} en ${form.bank_country === 'pe' ? 'Perú' : 'Brasil'} para ${selectedClientLabel.value}: ${bank} · ${id}.`
})
</script>

<template>
  <form class="space-y-5 p-6" @submit.prevent="submitCreate">
    <div class="rounded-xl bg-[#eef2ff] px-4 py-3"><p class="text-xs font-semibold uppercase text-brasper-indigoStrong">Para</p><p class="font-semibold text-[#1f2937]">{{ selectedClientLabel }}</p></div>
    <ol class="grid grid-cols-3 gap-2 text-center text-xs font-semibold"><li v-for="item in 3" :key="item" class="rounded-full px-2 py-2" :class="step === item ? 'bg-brasper-indigoStrong text-white' : step > item ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#f3f4f6] text-[#6b7280]'">{{ item }} · {{ item === 1 ? 'Tipo' : item === 2 ? 'Datos' : 'Confirmar' }}</li></ol>

    <section v-if="step === 1" class="space-y-5">
      <div v-if="isClientPickerMode"><label class="mb-1 block text-sm font-medium">Cliente</label><AppDropdown v-model="form.user_id" :options="clientOptions" :placeholder="clientsLoading ? 'Cargando…' : 'Seleccionar cliente'" searchable/><p v-if="fieldErrors.user_id" class="mt-1 text-xs text-[#dc2626]">{{ fieldErrors.user_id }}</p></div>
      <fieldset><legend class="mb-2 text-sm font-semibold">País del banco</legend><div class="grid grid-cols-2 gap-3"><label v-for="option in [{ value: 'pe', label: '🇵🇪 Perú' }, { value: 'br', label: '🇧🇷 Brasil' }]" :key="option.value" class="cursor-pointer rounded-xl border p-4 text-center" :class="form.bank_country === option.value ? 'border-brasper-indigoStrong bg-[#eef2ff]' : 'border-[#e5e7eb]'"><input v-model="form.bank_country" class="sr-only" type="radio" :value="option.value"/>{{ option.label }}</label></div></fieldset>
      <fieldset><legend class="mb-2 text-sm font-semibold">Uso de la cuenta</legend><div class="grid gap-3 sm:grid-cols-2"><label v-for="option in [{ value: 'origin', label: 'Origen', help: 'El cliente envía el dinero' }, { value: 'destination', label: 'Destino', help: 'El cliente recibe el dinero' }]" :key="option.value" class="cursor-pointer rounded-xl border p-4" :class="form.account_flow === option.value ? 'border-brasper-indigoStrong bg-[#eef2ff]' : 'border-[#e5e7eb]'"><input v-model="form.account_flow" class="mr-2" type="radio" :value="option.value"/><strong>{{ option.label }}</strong><p class="mt-1 text-xs text-[#6b7280]">{{ option.help }}</p></label></div></fieldset>
      <fieldset><legend class="mb-2 text-sm font-semibold">Titular</legend><div class="grid grid-cols-2 gap-3"><label v-for="option in [{ value: 'natural', label: 'Persona natural' }, { value: 'juridica', label: 'Persona jurídica' }]" :key="option.value" class="cursor-pointer rounded-xl border p-4 text-center" :class="form.holder_type === option.value ? 'border-brasper-indigoStrong bg-[#eef2ff]' : 'border-[#e5e7eb]'"><input v-model="form.holder_type" class="sr-only" type="radio" :value="option.value"/>{{ option.label }}</label></div></fieldset>
    </section>

    <section v-else-if="step === 2" class="space-y-5">
      <div><label class="mb-1 block text-sm font-medium">Banco *</label><AppDropdown v-model="form.bank_id" :options="filteredBankOptions" :placeholder="banksLoading ? 'Cargando…' : 'Seleccionar banco'" searchable/><p v-if="fieldErrors.bank_id" class="mt-1 text-xs text-[#dc2626]">{{ fieldErrors.bank_id }}</p></div>
      <div v-if="form.holder_type === 'natural'" class="grid gap-4 sm:grid-cols-2"><label class="text-sm">Nombres<input v-model.trim="form.holder_names" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label><label class="text-sm">Apellidos<input v-model.trim="form.holder_surnames" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label><label class="text-sm">{{ form.bank_country === 'pe' ? 'DNI' : 'CPF' }}<input v-if="form.bank_country === 'pe'" v-model="form.document_number" maxlength="8" inputmode="numeric" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/><input v-else v-model="form.cpf" maxlength="11" inputmode="numeric" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/><span v-if="fieldErrors.document_number || fieldErrors.cpf" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.document_number || fieldErrors.cpf }}</span></label></div>
      <div v-else class="grid gap-4 sm:grid-cols-2"><label class="text-sm sm:col-span-2">Razón social<input v-model.trim="form.business_name" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label><label class="text-sm">{{ form.bank_country === 'pe' ? 'RUC' : 'CNPJ' }}<input v-model="form.ruc_number" maxlength="11" inputmode="numeric" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/><span v-if="fieldErrors.ruc_number" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.ruc_number }}</span></label><label class="text-sm">Representante legal<input v-model.trim="form.legal_representative_name" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label><label class="text-sm">Documento del representante<input v-model="form.legal_representative_document" inputmode="numeric" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/></label></div>
      <div v-if="form.bank_country === 'pe'" class="grid gap-4 sm:grid-cols-2"><label class="text-sm">Número de cuenta<span v-if="requiresIdentifier"> *</span><input v-model="form.account_number" inputmode="numeric" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.account_number ? 'border-[#dc2626]' : 'border-[#e5e7eb]'"/><span v-if="fieldErrors.account_number" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.account_number }}</span></label><label class="text-sm">Confirmar número<input v-model="form.account_number_confirmation" inputmode="numeric" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.account_number_confirmation ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @paste.prevent/><span v-if="fieldErrors.account_number_confirmation" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.account_number_confirmation }}</span></label><label class="text-sm">CCI (20 dígitos)<input v-model="form.cci_number" maxlength="20" inputmode="numeric" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"/><span v-if="fieldErrors.cci_number" class="text-xs text-[#dc2626]">{{ fieldErrors.cci_number }}</span></label><label class="text-sm">Confirmar CCI<input v-model="form.cci_number_confirmation" maxlength="20" inputmode="numeric" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5" @paste.prevent/><span v-if="fieldErrors.cci_number_confirmation" class="text-xs text-[#dc2626]">{{ fieldErrors.cci_number_confirmation }}</span></label></div>
      <div v-else class="grid gap-4 sm:grid-cols-2"><label class="text-sm">Tipo de clave PIX *<select v-model="form.pix_key_type" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5"><option value="">Seleccionar</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">Correo</option><option value="phone">Celular</option><option value="random">Aleatoria</option></select></label><label class="text-sm">Clave PIX<span v-if="requiresIdentifier"> *</span><input v-model.trim="form.pix_key" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.pix_key ? 'border-[#dc2626]' : 'border-[#e5e7eb]'"/><span v-if="fieldErrors.pix_key" class="text-xs text-[#dc2626]">{{ fieldErrors.pix_key }}</span></label><label class="text-sm">Confirmar clave PIX<input v-model.trim="form.pix_key_confirmation" class="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5" @paste.prevent/><span v-if="fieldErrors.pix_key_confirmation" class="text-xs text-[#dc2626]">{{ fieldErrors.pix_key_confirmation }}</span></label></div>
    </section>

    <section v-else class="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5"><h3 class="font-semibold text-[#1f2937]">Confirma los datos</h3><p class="mt-3 text-sm leading-6 text-[#4b5563]">{{ summary }}</p></section>
    <p v-if="error" class="rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">{{ error }}</p>
    <footer class="flex justify-between gap-3 border-t border-[#e5e7eb] pt-5"><button type="button" class="rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm" @click="step > 1 ? step-- : emit('close')">{{ step > 1 ? '← Atrás' : 'Cancelar' }}</button><button v-if="step < 3" type="button" class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white" @click="next">Continuar →</button><button v-else type="submit" class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" :disabled="isCreating">{{ isCreating ? 'Guardando…' : 'Crear cuenta' }}</button></footer>
  </form>
</template>
