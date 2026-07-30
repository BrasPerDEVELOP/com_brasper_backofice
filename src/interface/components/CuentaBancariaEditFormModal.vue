<script setup lang="ts">
import { computed, reactive, ref, watch, nextTick } from 'vue'
import type { BankAccount } from '@/modules/cuentas-bancarias/domain/models'
import { useCuentasBancariasStore } from '@/modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import AppDropdown from './AppDropdown.vue'
import {
  bankMatchesCountry,
  digitsOnly,
  legalEntityDocumentLength,
  validateWizardStep2,
  type WizardCountry,
  type WizardHolder
} from './cuenta_bancaria_create_form_logic'

const props = defineProps<{
  modelValue: boolean
  account: BankAccount | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [account: BankAccount]
}>()

const cuentasStore = useCuentasBancariasStore()
const formRoot = ref<HTMLFormElement | null>(null)
const fieldErrors = reactive<Record<string, string>>({})

function normalizeCountry(value: string | undefined): WizardCountry {
  return (value ?? '').toLowerCase() === 'br' ? 'br' : 'pe'
}
function normalizeHolder(value: string | undefined): WizardHolder {
  const v = (value ?? '').toLowerCase()
  return v.includes('legal') || v.includes('jurid') ? 'juridica' : 'natural'
}

const form = reactive({
  bank_id: '',
  bank_country: 'pe' as WizardCountry,
  holder_type: 'natural' as WizardHolder,
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
  () => props.modelValue,
  (open) => {
    if (!open || !props.account) return
    cuentasStore.error = null
    Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
    void cuentasStore.loadBanks()
    const a = props.account
    form.bank_id = a.bank_id
    form.bank_country = normalizeCountry(a.bank_country)
    form.holder_type = normalizeHolder(a.account_holder_type)
    form.holder_names = a.holder_names ?? ''
    form.holder_surnames = a.holder_surnames ?? ''
    form.document_number = a.document_number ?? ''
    form.business_name = a.business_name ?? ''
    form.ruc_number = a.ruc_number ?? ''
    form.legal_representative_name = a.legal_representative_name ?? ''
    form.legal_representative_document = a.legal_representative_document ?? ''
    form.account_number = a.account_number ?? ''
    form.account_number_confirmation = a.account_number ?? ''
    form.cci_number = a.cci_number ?? ''
    form.cci_number_confirmation = a.cci_number ?? ''
    form.pix_key = a.pix_key ?? ''
    form.pix_key_confirmation = a.pix_key ?? ''
    form.pix_key_type = a.pix_key_type ?? ''
    form.cpf = a.cpf ?? ''
  }
)

const bankOptions = computed(() =>
  cuentasStore.banks
    .filter((bank) => bankMatchesCountry(bank.country, form.bank_country))
    .map((bank) => ({
      value: bank.id,
      label: `${bank.bank}${bank.currency ? ` (${bank.currency})` : ''}`
    }))
)
const contextLabel = computed(() =>
  [
    form.bank_country === 'pe' ? 'Perú' : 'Brasil',
    props.account?.account_flow === 'origin' ? 'Origen' : 'Destino',
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

function close() {
  emit('update:modelValue', false)
}

const toDigitsOrNull = (value: string): string | null => {
  const cleaned = digitsOnly(value)
  return cleaned || null
}

async function submitUpdate() {
  if (!props.account) return
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  Object.assign(fieldErrors, validateWizardStep2(form, 'accounts'))
  if (Object.keys(fieldErrors).length > 0) {
    void nextTick(() => {
      formRoot.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
    return
  }
  try {
    const updated = await cuentasStore.updateBankAccount({
      id: props.account.id,
      bank_id: form.bank_id,
      holder_names: form.holder_names || null,
      holder_surnames: form.holder_surnames || null,
      document_number: toDigitsOrNull(form.document_number),
      business_name: form.business_name || null,
      ruc_number: toDigitsOrNull(form.ruc_number),
      legal_representative_name: form.legal_representative_name || null,
      legal_representative_document: toDigitsOrNull(form.legal_representative_document),
      account_number: toDigitsOrNull(form.account_number),
      account_number_confirmation: toDigitsOrNull(form.account_number_confirmation),
      cci_number: toDigitsOrNull(form.cci_number),
      cci_number_confirmation: toDigitsOrNull(form.cci_number_confirmation),
      pix_key: form.pix_key || null,
      pix_key_confirmation: form.pix_key_confirmation || null,
      pix_key_type: form.pix_key_type || null,
      cpf: toDigitsOrNull(form.cpf)
    })
    emit('update:modelValue', false)
    emit('saved', updated)
  } catch {
    // Error visible desde el store
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && account"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white shadow-xl"
        @click.stop
      >
        <div class="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white px-6 py-5">
          <h2 class="text-lg font-semibold text-[#1f2937]">Editar cuenta bancaria</h2>
          <p class="mt-1 text-sm text-[#6b7280]">{{ contextLabel }}</p>
        </div>

        <form ref="formRoot" class="space-y-5 p-6" @submit.prevent="submitUpdate">
          <div>
            <label class="mb-1 block text-sm font-medium">Banco *</label>
            <AppDropdown v-model="form.bank_id" :options="bankOptions" placeholder="Seleccionar banco" searchable/>
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
            <label class="text-sm">Número de cuenta *
              <input :value="form.account_number" inputmode="numeric" :aria-invalid="!!fieldErrors.account_number" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.account_number ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'account_number')"/>
              <span v-if="fieldErrors.account_number" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.account_number }}</span>
            </label>
            <label class="text-sm">Confirmar número
              <input :value="form.account_number_confirmation" inputmode="numeric" :aria-invalid="!!fieldErrors.account_number_confirmation" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.account_number_confirmation ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'account_number_confirmation')"/>
              <span v-if="fieldErrors.account_number_confirmation" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.account_number_confirmation }}</span>
            </label>
            <label class="text-sm">CCI (20 dígitos)
              <input :value="form.cci_number" maxlength="20" inputmode="numeric" :aria-invalid="!!fieldErrors.cci_number" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.cci_number ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'cci_number')"/>
              <span v-if="fieldErrors.cci_number" class="text-xs text-[#dc2626]">{{ fieldErrors.cci_number }}</span>
            </label>
            <label class="text-sm">Confirmar CCI
              <input :value="form.cci_number_confirmation" maxlength="20" inputmode="numeric" :aria-invalid="!!fieldErrors.cci_number_confirmation" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.cci_number_confirmation ? 'border-[#dc2626]' : 'border-[#e5e7eb]'" @input="onNumericInput($event, 'cci_number_confirmation')"/>
              <span v-if="fieldErrors.cci_number_confirmation" class="text-xs text-[#dc2626]">{{ fieldErrors.cci_number_confirmation }}</span>
            </label>
          </div>
          <div v-else class="grid gap-4 sm:grid-cols-2">
            <label class="text-sm">Tipo de clave PIX *
              <select v-model="form.pix_key_type" :aria-invalid="!!fieldErrors.pix_key_type" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.pix_key_type ? 'border-[#dc2626]' : 'border-[#e5e7eb]'"><option value="">Seleccionar</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">Correo</option><option value="phone">Celular</option><option value="random">Aleatoria</option></select>
              <span v-if="fieldErrors.pix_key_type" class="mt-1 block text-xs text-[#dc2626]">{{ fieldErrors.pix_key_type }}</span>
            </label>
            <label class="text-sm">Clave PIX *
              <input v-model.trim="form.pix_key" :aria-invalid="!!fieldErrors.pix_key" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.pix_key ? 'border-[#dc2626]' : 'border-[#e5e7eb]'"/>
              <span v-if="fieldErrors.pix_key" class="text-xs text-[#dc2626]">{{ fieldErrors.pix_key }}</span>
            </label>
            <label class="text-sm">Confirmar clave PIX
              <input v-model.trim="form.pix_key_confirmation" :aria-invalid="!!fieldErrors.pix_key_confirmation" class="mt-1 w-full rounded-lg border px-3 py-2.5" :class="fieldErrors.pix_key_confirmation ? 'border-[#dc2626]' : 'border-[#e5e7eb]'"/>
              <span v-if="fieldErrors.pix_key_confirmation" class="text-xs text-[#dc2626]">{{ fieldErrors.pix_key_confirmation }}</span>
            </label>
          </div>

          <p v-if="cuentasStore.error" class="rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">{{ cuentasStore.error }}</p>

          <footer class="flex justify-end gap-3 border-t border-[#e5e7eb] pt-5">
            <button type="button" class="rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm" @click="close">Cancelar</button>
            <button type="submit" class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" :disabled="cuentasStore.isUpdating">{{ cuentasStore.isUpdating ? 'Guardando…' : 'Guardar cambios' }}</button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>
