<script setup lang="ts">
import { computed, ref } from 'vue'
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

const props = defineProps<{
  /** Muestra el estado de carga del catálogo mientras el shell hidrata la lista. */
  loading: boolean
  /** País del flujo de cuenta (prefijo al crear un banco nuevo). */
  hintCountry?: 'pe' | 'br'
}>()

const emit = defineEmits<{
  saved: [payload?: { selectBankId?: string; deletedBankId?: string }]
  close: []
}>()

const cuentasStore = useCuentasBancariasStore()
const { banks } = storeToRefs(cuentasStore)

type BankTableRow = {
  key: string
  id: string | null
  isNew: boolean
  bank: string
  currency: string
  country: string
  company: string
  account: string
}

const batchSaving = ref(false)
const rowSavingKey = ref<string | null>(null)
const deleteConfirmKey = ref<string | null>(null)
const error = ref('')
const tableRows = ref<BankTableRow[]>([])
/** IDs eliminados en esta sesión del modal (evita que vuelvan al recargar catálogo). */
const deletedBankIds = ref<Set<string>>(new Set())

let rowKeySeq = 0
function nextRowKey(): string {
  rowKeySeq += 1
  return `draft-${rowKeySeq}`
}

const sortedBanks = computed(() =>
  [...banks.value].sort((a, b) => {
    const companyA = (a.company ?? '').trim()
    const companyB = (b.company ?? '').trim()
    const byCompany = (companyA || a.bank).localeCompare(companyB || b.bank, 'es')
    if (byCompany !== 0) return byCompany
    return (a.bank ?? '').localeCompare(b.bank ?? '', 'es')
  })
)

const newRows = computed(() => tableRows.value.filter((r) => r.isNew))
const pendingNewCount = computed(() => newRows.value.length)

function defaultCurrencyForCountry(c: 'pe' | 'br'): string {
  return c === 'br' ? 'BRL' : 'PEN'
}

function createEmptyRow(): BankTableRow {
  const hc = props.hintCountry ?? 'pe'
  return {
    key: nextRowKey(),
    id: null,
    isNew: true,
    bank: '',
    currency: defaultCurrencyForCountry(hc),
    country: hc,
    company: '',
    account: ''
  }
}

function rowFromBank(b: BankOption): BankTableRow {
  return {
    key: `bank-${b.id}`,
    id: b.id,
    isNew: false,
    bank: b.bank ?? '',
    currency: (b.currency ?? '').toUpperCase(),
    country: (b.country ?? '').toLowerCase() || 'pe',
    company: b.company ?? '',
    account: b.account ?? ''
  }
}

/** Reconstruye las filas desde el catálogo del store, conservando los borradores. */
function initFromCatalog(appendEmptyRow = false) {
  const drafts = tableRows.value.filter((r) => r.isNew)
  const existing = sortedBanks.value
    .filter((b) => !deletedBankIds.value.has(b.id))
    .map(rowFromBank)
  tableRows.value = [...existing, ...drafts]
  if (appendEmptyRow && !drafts.length) {
    tableRows.value.push(createEmptyRow())
  }
}

function errMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    return formatApiErrorBody(e.response?.data) ?? e.message ?? fallback
  }
  if (e instanceof Error) return e.message
  return fallback
}

function addNewRow() {
  error.value = ''
  tableRows.value.push(createEmptyRow())
}

function removeNewRow(key: string) {
  error.value = ''
  tableRows.value = tableRows.value.filter((r) => r.key !== key)
}

function buildPayload(row: BankTableRow): CreateBankBody {
  return {
    bank: row.bank.trim(),
    currency: row.currency.trim().toUpperCase(),
    country: row.country.trim().toLowerCase(),
    company: row.company.trim() || null,
    account: row.account.trim() || null,
    pix: null as string | null
  }
}

function validateRow(row: BankTableRow, label: string): string | null {
  if (!row.bank.trim()) return `${label}: el nombre del banco es obligatorio`
  if (!row.currency.trim()) return `${label}: la moneda es obligatoria`
  if (!row.country.trim()) return `${label}: el país es obligatorio`
  return null
}

function rowLabel(index: number): string {
  return tableRows.value.length > 1 ? `Fila ${index + 1}` : 'La fila'
}

function isRowEmpty(row: BankTableRow): boolean {
  return !row.bank.trim() && !row.company.trim() && !row.account.trim()
}

async function saveRow(row: BankTableRow, index: number) {
  if (row.isNew && isRowEmpty(row)) {
    removeNewRow(row.key)
    return
  }

  const validationError = validateRow(row, rowLabel(index))
  if (validationError) {
    error.value = validationError
    return
  }

  rowSavingKey.value = row.key
  error.value = ''
  let lastSavedId: string | undefined

  try {
    const body = buildPayload(row)
    if (row.isNew) {
      const saved = await createBank(body)
      cuentasStore.upsertBankInCatalog(saved)
      lastSavedId = saved.id
      row.id = saved.id
      row.isNew = false
      row.key = `bank-${saved.id}`
    } else if (row.id) {
      const saved = await updateBank(row.id, body)
      cuentasStore.upsertBankInCatalog(saved)
      lastSavedId = saved.id
    }
    emit('saved', lastSavedId ? { selectBankId: lastSavedId } : {})
  } catch (e) {
    error.value = errMessage(e, row.isNew ? 'Error al crear' : 'Error al guardar')
  } finally {
    rowSavingKey.value = null
  }
}

function requestDeleteRow(row: BankTableRow) {
  error.value = ''
  if (row.isNew) {
    removeNewRow(row.key)
    return
  }
  deleteConfirmKey.value = row.key
}

function cancelDeleteRow() {
  deleteConfirmKey.value = null
}

async function confirmDeleteRow(row: BankTableRow) {
  const bankId = row.id?.trim()
  if (!bankId) {
    error.value = 'No se puede eliminar: el banco no tiene identificador'
    deleteConfirmKey.value = null
    return
  }

  rowSavingKey.value = row.key
  deleteConfirmKey.value = null
  error.value = ''

  try {
    await deleteBank(bankId)
    deletedBankIds.value = new Set([...deletedBankIds.value, bankId])
    cuentasStore.removeBankFromCatalog(bankId)
    tableRows.value = tableRows.value.filter((r) => r.key !== row.key && r.id !== bankId)
    emit('saved', { deletedBankId: bankId })
  } catch (e) {
    error.value = errMessage(e, 'No se pudo eliminar')
  } finally {
    rowSavingKey.value = null
  }
}

async function submitAllNew() {
  const rowsToCreate = newRows.value.filter((r) => !isRowEmpty(r))
  if (!rowsToCreate.length) {
    error.value = 'Agrega al menos una fila con datos o usa + para crear otra'
    return
  }

  for (let i = 0; i < rowsToCreate.length; i++) {
    const row = rowsToCreate[i]
    const index = tableRows.value.findIndex((r) => r.key === row?.key)
    const validationError = row ? validateRow(row, rowLabel(index >= 0 ? index : i)) : null
    if (validationError) {
      error.value = validationError
      return
    }
  }

  batchSaving.value = true
  error.value = ''
  let lastSavedId: string | undefined

  try {
    for (const row of rowsToCreate) {
      const saved = await createBank(buildPayload(row))
      cuentasStore.upsertBankInCatalog(saved)
      lastSavedId = saved.id
      row.id = saved.id
      row.isNew = false
      row.key = `bank-${saved.id}`
    }
    emit('saved', lastSavedId ? { selectBankId: lastSavedId } : {})
  } catch (e) {
    error.value = errMessage(e, 'Error al crear bancos')
  } finally {
    batchSaving.value = false
  }
}

function close() {
  emit('close')
}

defineExpose({ initFromCatalog })
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] p-5">
    <p v-if="loading" class="py-10 text-center text-sm text-[#6b7280]">Cargando catálogo…</p>

    <template v-else>
      <div class="overflow-x-auto rounded-xl border border-[#dbe4f0] bg-white shadow-sm">
        <table class="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-[#dbe4f0] bg-[#edf3fa]">
              <th class="w-10 px-2 py-3 text-center font-semibold text-[#334155]">#</th>
              <th class="min-w-[11rem] px-3 py-3 font-semibold text-[#334155]">Razón social</th>
              <th class="min-w-[9rem] px-3 py-3 font-semibold text-[#334155]">
                Banco <span class="text-[#dc2626]">*</span>
              </th>
              <th class="min-w-[6rem] px-3 py-3 font-semibold text-[#334155]">
                Moneda <span class="text-[#dc2626]">*</span>
              </th>
              <th class="min-w-[6rem] px-3 py-3 font-semibold text-[#334155]">
                País <span class="text-[#dc2626]">*</span>
              </th>
              <th class="min-w-[8rem] px-3 py-3 font-semibold text-[#334155]">Cuenta</th>
              <th class="min-w-[7rem] px-2 py-3 text-right font-semibold text-[#334155]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in tableRows"
              :key="row.key"
              class="border-b border-[#edf2f7] bg-white transition last:border-b-0"
              :class="row.isNew ? 'bg-[#f0f7ff]' : 'hover:bg-[#f8fbff]'"
            >
              <td class="px-2 py-2 text-center text-xs font-semibold text-[#94a3b8]">
                {{ index + 1 }}
              </td>
              <td class="px-2 py-2 align-top">
                <input
                  v-model="row.company"
                  type="text"
                  class="form-input w-full min-w-[10rem] rounded-lg border border-[#e5e7eb] px-2.5 py-2 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Ej. Brasper 21 SAC"
                  autocomplete="off"
                />
              </td>
              <td class="px-2 py-2 align-top">
                <input
                  v-model="row.bank"
                  type="text"
                  class="form-input w-full min-w-[8rem] rounded-lg border border-[#e5e7eb] px-2.5 py-2 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  placeholder="Ej. BCP"
                  autocomplete="off"
                />
              </td>
              <td class="px-2 py-2 align-top">
                <select
                  v-model="row.currency"
                  class="form-select w-full min-w-[5.5rem] rounded-lg border border-[#e5e7eb] px-2 py-2 text-sm uppercase focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                >
                  <option value="" disabled>—</option>
                  <option v-for="c in CURRENCY_CODES" :key="c" :value="c.toUpperCase()">
                    {{ c.toUpperCase() }}
                  </option>
                </select>
              </td>
              <td class="px-2 py-2 align-top">
                <select
                  v-model="row.country"
                  class="form-select w-full min-w-[5.5rem] rounded-lg border border-[#e5e7eb] px-2 py-2 text-sm lowercase focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                >
                  <option value="" disabled>—</option>
                  <option value="pe">pe</option>
                  <option value="br">br</option>
                </select>
              </td>
              <td class="px-2 py-2 align-top">
                <input
                  v-model="row.account"
                  type="text"
                  class="form-input w-full min-w-[7rem] rounded-lg border border-[#e5e7eb] px-2.5 py-2 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
                  autocomplete="off"
                />
              </td>
              <td class="px-2 py-2 align-top">
                <div
                  v-if="deleteConfirmKey === row.key"
                  class="flex min-w-[5.5rem] flex-col items-end gap-1"
                  @click.stop
                >
                  <span class="text-[10px] font-medium text-[#64748b]">¿Eliminar?</span>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="rounded-lg bg-[#dc2626] px-2 py-1 text-xs font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50"
                      :disabled="rowSavingKey === row.key"
                      @click.stop="confirmDeleteRow(row)"
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      class="rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-medium text-[#64748b] hover:bg-[#f9fafb]"
                      :disabled="rowSavingKey === row.key"
                      @click.stop="cancelDeleteRow"
                    >
                      No
                    </button>
                  </div>
                </div>
                <div v-else class="flex items-center justify-end gap-1.5" @click.stop>
                  <button
                    type="button"
                    class="flex h-9 w-9 items-center justify-center rounded-full border border-[#c7d2fe] bg-white text-brasper-indigoStrong shadow-sm transition hover:bg-[#eef2ff] disabled:opacity-50"
                    :disabled="rowSavingKey === row.key || batchSaving"
                    :title="row.isNew ? 'Guardar fila nueva' : 'Guardar cambios'"
                    @click.stop="saveRow(row, index)"
                  >
                    <svg
                      v-if="rowSavingKey === row.key"
                      class="h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <svg
                      v-else
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="flex h-9 w-9 items-center justify-center rounded-full border border-[#fecaca] bg-white text-[#dc2626] shadow-sm transition hover:bg-[#fef2f2] disabled:opacity-50"
                    :disabled="rowSavingKey === row.key || batchSaving"
                    title="Eliminar fila"
                    @click.stop="requestDeleteRow(row)"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center gap-3">
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brasper-indigoStrong text-white shadow-md transition hover:bg-brasper-indigoDark disabled:opacity-60"
          title="Agregar fila"
          :disabled="batchSaving"
          @click="addNewRow"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5" />
          </svg>
        </button>
        <span class="text-sm text-[#64748b]">Agregar otra fila de banco</span>
      </div>

      <p v-if="!tableRows.length" class="py-6 text-center text-sm text-[#6b7280]">
        No hay bancos. Usa + para agregar el primero.
      </p>
    </template>

    <p v-if="error" class="mt-4 rounded-lg bg-[#dc3545]/10 px-3 py-2.5 text-sm text-[#dc3545]">
      {{ error }}
    </p>
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] bg-white px-5 py-4">
    <p v-if="pendingNewCount > 0" class="text-sm text-[#64748b]">
      <span class="font-semibold text-[#334155]">{{ pendingNewCount }}</span>
      {{ pendingNewCount === 1 ? 'fila nueva pendiente' : 'filas nuevas pendientes' }}
    </p>
    <span v-else />

    <div class="flex gap-3">
      <button
        type="button"
        class="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb]"
        @click="close"
      >
        Cerrar
      </button>
      <button
        v-if="pendingNewCount > 0"
        type="button"
        class="rounded-lg bg-brasper-indigoStrong px-5 py-2.5 text-sm font-semibold text-white hover:bg-brasper-indigoDark disabled:opacity-60"
        :disabled="batchSaving || !!rowSavingKey"
        @click="submitAllNew"
      >
        {{
          batchSaving
            ? 'Guardando…'
            : pendingNewCount > 1
              ? `Añadir ${pendingNewCount} bancos`
              : 'Añadir'
        }}
      </button>
    </div>
  </div>
</template>
