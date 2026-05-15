<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { CURRENCY_CODES } from '@/modules/calculator/domain/models/currency_code'
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

const sortedBanks = computed(() =>
  [...banks.value].sort((a, b) => {
    const companyA = (a.company ?? '').trim()
    const companyB = (b.company ?? '').trim()
    const byCompany = (companyA || a.bank).localeCompare(companyB || b.bank, 'es')
    if (byCompany !== 0) return byCompany
    return (a.bank ?? '').localeCompare(b.bank ?? '', 'es')
  })
)

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
  const company = form.company.trim()
  const account = form.account.trim()
  const pix = form.pix.trim()

  const body: CreateBankBody = {
    bank: form.bank.trim(),
    currency: form.currency.trim().toUpperCase(),
    country: form.country.trim().toLowerCase(),
    company: company || null,
    account: account || null,
    pix: pix || null
  }

  return body
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
        class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-2xl shadow-slate-900/20"
        @click.stop
      >
        <div class="flex items-start justify-between gap-4 border-b border-[#e5eaf2] px-6 py-5">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-brasper-indigoStrong">
              Catálogo
            </p>
            <h2 class="mt-1 text-xl font-semibold text-[#111827]">
              {{ mode === 'list' ? 'Bancos' : editingId ? 'Editar banco' : 'Nuevo banco' }}
            </h2>
            <p class="mt-1 text-sm text-[#64748b]">
              <template v-if="mode === 'list'">
                Lista y mantenimiento de bancos para transacciones
                <span v-if="listRefreshing" class="ml-2 font-medium text-[#0369a1]">· Sincronizando…</span>
              </template>
              <template v-else>
                Completa nombre, moneda y país. Los demás datos son opcionales.
              </template>
            </p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dbe4f0] bg-white text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#111827]"
            title="Cerrar"
            @click="close"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] p-5">
          <template v-if="mode === 'list'">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div class="text-sm text-[#64748b]">
                <span class="font-semibold text-[#334155]">{{ sortedBanks.length }}</span>
                bancos registrados
              </div>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brasper-indigoDark disabled:opacity-60"
                :disabled="loading"
                @click="openFormNew"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5" />
                </svg>
                Nuevo banco
              </button>
            </div>
            <p v-if="loading" class="py-8 text-center text-sm text-[#6b7280]">Cargando…</p>
            <div v-else-if="sortedBanks.length > 0" class="overflow-hidden rounded-xl border border-[#dbe4f0] bg-white shadow-sm">
              <table class="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="sticky top-0 z-10 border-b border-[#dbe4f0] bg-[#edf3fa]">
                    <th class="px-4 py-3 font-semibold text-[#334155]">Razón social</th>
                    <th class="px-4 py-3 font-semibold text-[#334155]">Banco</th>
                    <th class="whitespace-nowrap px-4 py-3 font-semibold text-[#334155]">Moneda / País</th>
                    <th class="w-1 px-3 py-3 text-right font-semibold text-[#334155]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="b in sortedBanks"
                    :key="b.id"
                    class="border-b border-[#edf2f7] bg-white transition last:border-b-0 hover:bg-[#f8fbff]"
                  >
                    <td class="max-w-[17rem] px-4 py-3 align-middle text-[#374151]">
                      <p class="truncate font-medium" :title="b.company ?? ''">
                        {{ b.company?.trim() ? b.company : '—' }}
                      </p>
                    </td>
                    <td class="max-w-[13rem] px-4 py-3 align-middle">
                      <p class="truncate font-semibold text-[#111827]" :title="b.bank">{{ b.bank }}</p>
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 align-middle">
                      <div class="flex items-center gap-2">
                        <span class="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-semibold text-brasper-indigoStrong">
                          {{ b.currency?.toUpperCase() || '—' }}
                        </span>
                        <span class="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-semibold text-[#64748b]">
                          {{ b.country?.toUpperCase() || '—' }}
                        </span>
                      </div>
                    </td>
                    <td class="px-3 py-2.5 align-middle">
                      <div class="flex shrink-0 justify-end gap-2">
                        <button
                          type="button"
                          class="flex h-8 w-8 items-center justify-center rounded-full border border-[#c7d2fe] bg-white text-brasper-indigoStrong shadow-sm transition hover:bg-[#eef2ff]"
                          title="Editar banco"
                          @click="openFormEdit(b)"
                        >
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.651-1.651a1.875 1.875 0 112.652 2.652L9.75 16.903 6 18l1.097-3.75L16.862 4.487z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="flex h-8 w-8 items-center justify-center rounded-full border border-[#fecaca] bg-white text-[#dc2626] shadow-sm transition hover:bg-[#fef2f2]"
                          title="Eliminar banco"
                          @click="onDelete(b)"
                        >
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M19.228 5.79L18.16 19.673A2.25 2.25 0 0115.916 21H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916A2.25 2.25 0 0013.5 2.25h-3A2.25 2.25 0 008.25 4.5v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="py-8 text-center text-sm text-[#6b7280]">No hay bancos registrados.</p>
          </template>

          <form v-else class="space-y-4 rounded-xl border border-[#dbe4f0] bg-white p-5 shadow-sm" @submit.prevent="submitForm">
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
                <select
                  v-model="form.currency"
                  class="form-select w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm uppercase focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                >
                  <option value="" disabled>Seleccionar</option>
                  <option v-for="c in CURRENCY_CODES" :key="c" :value="c.toUpperCase()">
                    {{ c.toUpperCase() }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">País *</label>
                <select
                  v-model="form.country"
                  class="form-select w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm lowercase focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                >
                  <option value="" disabled>Seleccionar</option>
                  <option value="pe">pe - Perú</option>
                  <option value="br">br - Brasil</option>
                </select>
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[#374151]">Razón social (opcional)</label>
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
                <label class="block text-sm font-medium text-[#374151]">Cuenta (opcional)</label>
                <input
                  v-model="form.account"
                  type="text"
                  class="form-input w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  autocomplete="off"
                />
              </div>
              <div class="space-y-1.5">
                <label class="block text-sm font-medium text-[#374151]">PIX / texto PIX (opcional)</label>
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
