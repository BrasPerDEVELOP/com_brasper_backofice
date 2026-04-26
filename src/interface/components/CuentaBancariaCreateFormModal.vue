<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import type { BankAccount } from '@/modules/cuentas-bancarias/domain/models'
import { useCuentasBancariasStore } from '@/modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import AppDropdown from '@/interface/components/AppDropdown.vue'
import UsuarioCreateFormModal from '@/interface/components/UsuarioCreateFormModal.vue'

const props = defineProps<{
  modelValue: boolean
  accountFlow: 'origin' | 'destination'
  bankCountry: 'pe' | 'br'
  holderType: 'natural' | 'juridica'
  /** Si se define, la cuenta se asigna a este usuario (sin selector de cliente). */
  lockedUserId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [account: BankAccount]
}>()

const cuentasStore = useCuentasBancariasStore()
const showUsersModal = ref(false)

const form = reactive({
  user_id: '' as string,
  bank_id: '',
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

function resetForm() {
  form.user_id = ''
  form.bank_id = ''
  form.holder_names = ''
  form.holder_surnames = ''
  form.document_number = ''
  form.business_name = ''
  form.ruc_number = ''
  form.legal_representative_name = ''
  form.legal_representative_document = ''
  form.account_number = ''
  form.account_number_confirmation = ''
  form.cci_number = ''
  form.cci_number_confirmation = ''
  form.pix_key = ''
  form.pix_key_confirmation = ''
  form.pix_key_type = ''
  form.cpf = ''
}

function mapHolderTypeToApi(value: string): 'naturalPerson' | 'legalEntity' | 'generalAspect' {
  if (value === 'persona_juridica') return 'legalEntity'
  if (value === 'persona_natural') return 'naturalPerson'
  return 'naturalPerson'
}

function toIntOrNull(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const n = Number(value.replace(/\D/g, ''))
  return Number.isFinite(n) ? n : null
}

function onNumericKeydown(e: KeyboardEvent) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) {
    if (['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return
  }
  if (!/^\d$/.test(e.key)) e.preventDefault()
}

function onNumericInput(
  e: Event,
  key:
    | 'document_number'
    | 'ruc_number'
    | 'legal_representative_document'
    | 'account_number'
    | 'account_number_confirmation'
    | 'cci_number'
    | 'cci_number_confirmation'
    | 'cpf'
) {
  const target = e.target as HTMLInputElement
  const cleaned = target.value.replace(/\D/g, '')
  form[key] = cleaned
  target.value = cleaned
}

function onStringInput(
  e: Event,
  key:
    | 'holder_names'
    | 'holder_surnames'
    | 'business_name'
    | 'legal_representative_name'
    | 'pix_key'
    | 'pix_key_confirmation'
    | 'pix_key_type'
) {
  const target = e.target as HTMLInputElement
  const cleaned = target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.@]/g, '')
  form[key] = cleaned
  target.value = cleaned
}

const bankOptions = computed(() =>
  cuentasStore.banks.map((b) => ({
    value: b.id,
    label: `${b.bank}${b.currency ? ` (${b.currency})` : ''}`
  }))
)

const clientFormOptions = computed(() =>
  cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name }))
)

const isClientPickerMode = computed(
  () => !props.lockedUserId?.trim()
)

async function submitCreate() {
  const userId = props.lockedUserId?.trim() || form.user_id
  if (!userId) {
    cuentasStore.error = 'Seleccione un cliente'
    return
  }
  try {
    const payload: Parameters<typeof cuentasStore.createBankAccount>[0] = {
      bank_id: form.bank_id,
      account_flow: props.accountFlow,
      account_holder_type: mapHolderTypeToApi(
        props.holderType === 'natural' ? 'persona_natural' : 'persona_juridica'
      ),
      bank_country: props.bankCountry,
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
    }
    payload.user_id = userId
    const created = await cuentasStore.createBankAccount(payload)
    emit('update:modelValue', false)
    resetForm()
    emit('created', created)
  } catch {
    // Error en store
  }
}

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    cuentasStore.error = null
    resetForm()
    void cuentasStore.loadBanks()
    void cuentasStore.loadClientUsers()
  }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="close"
    >
      <div
        class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white shadow-xl"
        @click.stop
      >
        <div class="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white px-6 py-5">
          <h2 class="text-lg font-semibold text-[#1f2937]">Nueva cuenta bancaria</h2>
          <div
            class="mt-3 inline-flex rounded-lg bg-[#f0f9ff] px-3 py-1.5 text-sm font-medium text-[#0369a1]"
          >
            {{ holderType === 'natural' ? 'Persona natural' : 'Persona jurídica' }} ·
            {{ bankCountry.toUpperCase() }} ·
            {{ accountFlow === 'destination' ? 'Destino' : 'Origen' }}
          </div>
        </div>

        <form class="space-y-6 p-6" @submit.prevent="submitCreate">
          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
              Banco y asignación
            </h3>
            <div class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Banco</label>
                <AppDropdown
                  v-model="form.bank_id"
                  :options="bankOptions"
                  :placeholder="cuentasStore.banks.length === 0 ? 'Cargando...' : 'Seleccionar banco'"
                  :searchable="bankOptions.length > 10"
                />
              </div>
              <div v-if="isClientPickerMode" class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Cliente</label>
                <div class="flex gap-2">
                  <AppDropdown
                    v-model="form.user_id"
                    :options="clientFormOptions"
                    :placeholder="
                      cuentasStore.clientUsers.length === 0 ? 'Cargando...' : 'Seleccionar cliente'
                    "
                    :searchable="clientFormOptions.length > 10"
                    class="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    class="flex shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-2.5 text-[#6b7280] transition hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#374151]"
                    title="Nuevo cliente"
                    @click="showUsersModal = true"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div v-else class="flex items-end">
                <div class="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm">
                  <p class="text-xs font-medium text-[#6b7280]">Cliente asignado</p>
                  <p class="mt-0.5 font-medium text-[#374151]">
                    {{
                      cuentasStore.clientUsers.find((u) => u.id === lockedUserId)?.name ??
                      lockedUserId
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
              Datos del titular
            </h3>
            <div v-if="holderType === 'natural'" class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Nombres</label>
                <input
                  :value="form.holder_names"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Ej. Juan Carlos"
                  inputmode="text"
                  @input="onStringInput($event, 'holder_names')"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Apellidos</label>
                <input
                  :value="form.holder_surnames"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Ej. Pérez García"
                  inputmode="text"
                  @input="onStringInput($event, 'holder_surnames')"
                />
              </div>
              <div class="space-y-1.5 sm:col-span-2">
                <label class="block text-sm font-medium text-[#374151]"
                  >Número de documento (DNI)</label
                >
                <input
                  :value="form.document_number"
                  type="text"
                  class="form-input w-full max-w-xs rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Ej. 12345678"
                  inputmode="numeric"
                  maxlength="15"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'document_number')"
                />
              </div>
            </div>
            <div v-if="holderType === 'juridica'" class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-1.5 sm:col-span-2">
                <label class="block text-sm font-medium text-[#374151]">Razón social</label>
                <input
                  :value="form.business_name"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Nombre de la empresa"
                  inputmode="text"
                  @input="onStringInput($event, 'business_name')"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Número RUC</label>
                <input
                  :value="form.ruc_number"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="11 dígitos"
                  inputmode="numeric"
                  maxlength="11"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'ruc_number')"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Nombre rep. legal</label>
                <input
                  :value="form.legal_representative_name"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  inputmode="text"
                  @input="onStringInput($event, 'legal_representative_name')"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Doc. rep. legal</label>
                <input
                  :value="form.legal_representative_document"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  inputmode="numeric"
                  maxlength="15"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'legal_representative_document')"
                />
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
              Datos de la cuenta
            </h3>
            <div class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Número de cuenta</label>
                <input
                  :value="form.account_number"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  inputmode="numeric"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'account_number')"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]"
                  >Confirmar número de cuenta</label
                >
                <input
                  :value="form.account_number_confirmation"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  inputmode="numeric"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'account_number_confirmation')"
                />
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
              Códigos interbancarios
            </h3>
            <div class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Número CCI</label>
                <input
                  :value="form.cci_number"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Código de cuenta interbancario (PE)"
                  inputmode="numeric"
                  @keydown="onNumericKeydown"
                  @input="onNumericInput($event, 'cci_number')"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Clave PIX</label>
                <input
                  :value="form.pix_key"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm transition focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Clave PIX (BR) - email, teléfono o aleatorio"
                  inputmode="text"
                  @input="onStringInput($event, 'pix_key')"
                />
              </div>
            </div>
          </div>

          <p
            v-if="cuentasStore.error"
            class="rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
          >
            {{ cuentasStore.error }}
          </p>

          <div class="flex flex-wrap justify-end gap-3 border-t border-[#e5e7eb] pt-6">
            <button
              type="button"
              class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
              @click="close"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
              :disabled="cuentasStore.isCreating"
            >
              {{ cuentasStore.isCreating ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <UsuarioCreateFormModal
    v-model="showUsersModal"
    :show-role-field="false"
    default-role="client"
    @created="
      (user) => {
        form.user_id = user.id
        cuentasStore.loadClientUsers(true)
      }
    "
  />
</template>
