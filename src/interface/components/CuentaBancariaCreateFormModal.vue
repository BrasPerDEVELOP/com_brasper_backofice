<script setup lang="ts">
import { computed, watch } from 'vue'
import type { BankAccount } from '@/modules/cuentas-bancarias/domain/models'
import type { CreateBankAccountPayload } from '@/modules/cuentas-bancarias/infrastructure/adapters/cuentas_bancarias_repository'
import { useCuentasBancariasStore } from '@/modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import CuentaBancariaCreateForm from '@/interface/components/CuentaBancariaCreateForm.vue'

const props = defineProps<{
  modelValue: boolean
  accountFlow: 'origin' | 'destination'
  bankCountry: 'pe' | 'br'
  holderType: 'natural' | 'juridica'
  /** Si se define, la cuenta se asigna a este usuario (sin selector de cliente). */
  lockedUserId?: string
  variant?: 'accounts' | 'transaction'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [account: BankAccount]
}>()

const cuentasStore = useCuentasBancariasStore()

const bankOptions = computed(() =>
  cuentasStore.banks.map((b) => ({
    value: b.id,
    label: `${b.bank}${b.currency ? ` (${b.currency})` : ''}`,
    country: b.country
  }))
)

const clientOptions = computed(() =>
  cuentasStore.clientUsers.map((u) => ({ value: u.id, label: u.name }))
)

const banksLoading = computed(() => cuentasStore.banks.length === 0)

const clientsLoading = computed(() => cuentasStore.clientUsers.length === 0)

const lockedUserName = computed(
  () =>
    cuentasStore.clientUsers.find((u) => u.id === props.lockedUserId)?.name ??
    props.lockedUserId ??
    ''
)

async function onSubmit(payload: CreateBankAccountPayload) {
  try {
    const created = await cuentasStore.createBankAccount(payload)
    emit('update:modelValue', false)
    emit('created', created)
  } catch {
    // Error en store
  }
}

function onValidationError(message: string) {
  cuentasStore.error = message
}

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    cuentasStore.error = null
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

        <CuentaBancariaCreateForm
          :account-flow="accountFlow"
          :bank-country="bankCountry"
          :holder-type="holderType"
          :locked-user-id="lockedUserId"
          :bank-options="bankOptions"
          :client-options="clientOptions"
          :banks-loading="banksLoading"
          :clients-loading="clientsLoading"
          :locked-user-name="lockedUserName"
          :error="cuentasStore.error"
          :is-creating="cuentasStore.isCreating"
          :variant="variant ?? 'transaction'"
          @submit="onSubmit"
          @close="close"
          @validation-error="onValidationError"
          @reload-banks="cuentasStore.loadBanks(true)"
          @reload-clients="cuentasStore.loadClientUsers(true)"
        />
      </div>
    </div>
  </Teleport>
</template>
