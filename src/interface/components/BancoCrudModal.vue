<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  createBank,
  updateBank,
  deleteBank,
  type BankOption,
  type CreateBankBody
} from '@/modules/cuentas-bancarias/infrastructure/adapters/banks_api_adapter'
import { useCuentasBancariasStore } from '@/modules/cuentas-bancarias/presentation/controllers/use_cuentas_bancarias_store_controller'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import axios from 'axios'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** País del flujo de cuenta (prefijo al crear un banco nuevo). */
    hintCountry?: 'pe' | 'br'
    /** Si true, tras cargar el catálogo abre directo el formulario de nuevo banco. */
    startOnCreateForm?: boolean
  }>(),
  { startOnCreateForm: false }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Tras crear/editar incluye selectBankId; tras eliminar solo refresca catálogo. */
  saved: [payload?: { selectBankId?: string }]
}>()

const cuentasStore = useCuentasBancariasStore()
const { banks } = storeToRefs(cuentasStore)

type Mode = 'list' | 'form'

const mode = ref<Mode>('list')
/** Solo primer fetch sin caché; con datos en store la lista se muestra al instante y se refresca en segundo plano. */
const loading = ref(false)
const listRefreshing = ref(false)
const saving = ref(false)
const error = ref('')

const form = reactive({
  bank: '',
  currency: '',
  country: '',
  company: '',
  account: '',
  pix: ''
})

const editingId = ref<string | null>(null)

function defaultCurrencyForCountry(c: 'pe' | 'br'): string {
  return c === 'br' ? 'BRL' : 'PEN'
}

function resetFormForNew() {
  editingId.value = null
  const hc = props.hintCountry ?? 'pe'
  form.bank = ''
  form.currency = defaultCurrencyForCountry(hc)
  form.country = hc
  form.company = ''
  form.account = ''
  form.pix = ''
}

function fillFormFromBank(b: BankOption) {
  editingId.value = b.id
  form.bank = b.bank ?? ''
  form.currency = b.currency ?? ''
  form.country = (b.country ?? '').toLowerCase() || 'pe'
  form.company = b.company ?? ''
  form.account = b.account ?? ''
  form.pix = b.pix ?? ''
}

function errMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    return formatApiErrorBody(e.response?.data) ?? e.message ?? fallback
  }
  if (e instanceof Error) return e.message
  return fallback
}

async function hydrateBankList() {
  error.value = ''
  if (cuentasStore.banks.length > 0) {
    listRefreshing.value = true
    void cuentasStore.loadBanks(true).finally(() => {
      listRefreshing.value = false
    })
    return
  }
  loading.value = true
  try {
    await cuentasStore.loadBanks(false)
  } finally {
    loading.value = false
  }
}

function openFormNew() {
  error.value = ''
  resetFormForNew()
  mode.value = 'form'
}

function openFormEdit(b: BankOption) {
  error.value = ''
  fillFormFromBank(b)
  mode.value = 'form'
}

function backToList() {
  mode.value = 'list'
  error.value = ''
}

function close() {
  emit('update:modelValue', false)
}

function buildPayload(): CreateBankBody {
  return {
    bank: form.bank.trim(),
    currency: form.currency.trim().toUpperCase(),
    country: form.country.trim().toLowerCase(),
    company: form.company.trim() || null,
    account: form.account.trim() || null,
    pix: form.pix.trim() || null
  }
}

async function submitForm() {
  if (!form.bank.trim()) {
    error.value = 'El nombre del banco es obligatorio'
    return
  }
  if (!form.currency.trim()) {
    error.value = 'La moneda es obligatoria'
    return
  }
  if (!form.country.trim()) {
    error.value = 'El país es obligatorio'
    return
  }

  saving.value = true
  error.value = ''
  try {
    const body = buildPayload()
    const saved = editingId.value
      ? await updateBank(editingId.value, body)
      : await createBank(body)
    cuentasStore.upsertBankInCatalog(saved)
    emit('saved', { selectBankId: saved.id })
    mode.value = 'list'
    void cuentasStore.loadBanks(true)
  } catch (e) {
    error.value = errMessage(e, editingId.value ? 'Error al guardar' : 'Error al crear')
  } finally {
    saving.value = false
  }
}

async function onDelete(b: BankOption) {
  const ok = window.confirm(`¿Eliminar el banco «${b.bank}»?`)
  if (!ok) return
  error.value = ''
  try {
    await deleteBank(b.id)
    cuentasStore.removeBankFromCatalog(b.id)
    emit('saved', {})
    void cuentasStore.loadBanks(true)
  } catch (e) {
    error.value = errMessage(e, 'No se pudo eliminar')
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      mode.value = 'list'
      error.value = ''
      return
    }
    await hydrateBankList()
    if (props.startOnCreateForm) {
      openFormNew()
    }
  }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-xl"
        @click.stop
      >
        <div class="border-b border-[#e5e7eb] px-5 py-4">
          <h2 class="text-lg font-semibold text-[#1f2937]">
            {{ mode === 'list' ? 'Bancos' : editingId ? 'Editar banco' : 'Nuevo banco' }}
          </h2>
          <p class="mt-1 text-xs text-[#6b7280]">
            <template v-if="mode === 'list'">
              Lista y mantenimiento (API transactions/banks/)
              <span v-if="listRefreshing" class="ml-2 font-medium text-[#0369a1]">· Sincronizando…</span>
            </template>
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <template v-if="mode === 'list'">
            <div class="mb-3 flex justify-end">
              <button
                type="button"
                class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-semibold text-white hover:bg-brasper-indigoDark disabled:opacity-60"
                :disabled="loading"
                @click="openFormNew"
              >
                Nuevo banco
              </button>
            </div>
            <p v-if="loading" class="py-8 text-center text-sm text-[#6b7280]">Cargando…</p>
            <div v-else-if="banks.length > 0" class="overflow-x-auto rounded-xl border border-[#e8eef3]">
              <table class="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-[#e8eef3] bg-[#f1f5f9]">
                    <th class="px-3 py-2.5 font-semibold text-[#374151]">Nombre del banco</th>
                    <th class="px-3 py-2.5 font-semibold text-[#374151]">Razón social</th>
                    <th class="whitespace-nowrap px-3 py-2.5 font-semibold text-[#374151]">Moneda / País</th>
                    <th class="w-1 px-2 py-2.5 text-right font-semibold text-[#374151]"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="b in banks"
                    :key="b.id"
                    class="border-b border-[#e8eef3] bg-[#fbfdff] last:border-b-0"
                  >
                    <td class="max-w-[10rem] px-3 py-2.5 align-middle">
                      <p class="truncate font-medium text-[#1f2937]" :title="b.bank">{{ b.bank }}</p>
                    </td>
                    <td class="max-w-[12rem] px-3 py-2.5 align-middle text-[#374151]">
                      <p class="truncate text-sm" :title="b.company ?? ''">
                        {{ b.company?.trim() ? b.company : '—' }}
                      </p>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-[#6b7280]">
                      {{ b.currency?.toUpperCase() }} · {{ b.country?.toUpperCase() }}
                    </td>
                    <td class="px-2 py-2 align-middle">
                      <div class="flex shrink-0 justify-end gap-1">
                        <button
                          type="button"
                          class="rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#f9fafb]"
                          @click="openFormEdit(b)"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          class="rounded-lg border border-[#fecaca] px-2.5 py-1.5 text-xs font-medium text-[#b91c1c] hover:bg-[#fef2f2]"
                          @click="onDelete(b)"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="py-8 text-center text-sm text-[#6b7280]">No hay bancos registrados.</p>
          </template>

          <form v-else class="space-y-4" @submit.prevent="submitForm">
            <button
              type="button"
              class="mb-2 text-sm font-medium text-brasper-indigoStrong hover:underline"
              @click="backToList"
            >
              ← Volver al listado
            </button>
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[#374151]">Nombre del banco *</label>
              <input
                v-model="form.bank"
                type="text"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="Ej. Bradesco"
                autocomplete="off"
              />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Moneda *</label>
                <input
                  v-model="form.currency"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm uppercase focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="BRL, PEN…"
                  autocomplete="off"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">País *</label>
                <input
                  v-model="form.country"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm lowercase focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="pe, br…"
                  autocomplete="off"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[#374151]">Razón social (empresa / titular cuenta)</label>
              <input
                v-model="form.company"
                type="text"
                class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                placeholder="Ej. Brasper 21 Corretora De Cambio Ltda"
                autocomplete="off"
              />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">Cuenta</label>
                <input
                  v-model="form.account"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  autocomplete="off"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">PIX / texto PIX</label>
                <input
                  v-model="form.pix"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="No disponible, clave, etc."
                  autocomplete="off"
                />
              </div>
            </div>
          </form>

          <p v-if="error" class="mt-4 rounded-lg bg-[#dc3545]/10 px-3 py-2.5 text-sm text-[#dc3545]">
            {{ error }}
          </p>
        </div>

        <div v-if="mode === 'form'" class="flex justify-end gap-3 border-t border-[#e5e7eb] px-5 py-4">
          <button
            type="button"
            class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb]"
            @click="backToList"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark disabled:opacity-60"
            :disabled="saving"
            @click="submitForm"
          >
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>

        <div v-else class="flex justify-end border-t border-[#e5e7eb] px-5 py-4">
          <button
            type="button"
            class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb]"
            @click="close"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
