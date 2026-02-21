<template>
  <div class="space-y-6">
    <section class="overflow-hidden rounded-3xl border border-[#d8e5fb] bg-white p-8 shadow-lg shadow-[#007bff]/5">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Operaciones</p>
          <h1 class="text-2xl font-semibold text-[#232b4d]">Transacciones</h1>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-[#5ED6B3]/60 bg-white px-4 py-2.5 text-sm font-medium text-[#066ac9] transition hover:bg-[#5ED6B3]/10"
          @click="showImportModal = true"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Importar
        </button>
      </div>

      <p v-if="transactionsStore.error" class="mb-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]">
        {{ transactionsStore.error }}
      </p>

      <div v-if="transactionsStore.isLoading" class="py-12 text-center text-[#666]">
        Cargando transacciones...
      </div>

      <div
        v-else-if="transactionsStore.transactions.length === 0"
        class="rounded-xl border border-[#dbe7fb] bg-[#fbfdff] px-6 py-12 text-center"
      >
        <p class="text-[#666]">
          No hay transacciones. Importa un archivo Excel (.xlsx) con el esquema indicado.
        </p>
      </div>

      <div v-else class="overflow-x-auto rounded-2xl border border-[#dbe7fb]">
        <table class="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr class="bg-gradient-to-r from-[#066ac9]/90 to-[#4A52D8]/90 text-white">
              <th
                v-for="col in tableColumns"
                :key="col.key"
                class="whitespace-nowrap px-3 py-3 font-semibold first:rounded-tl-2xl last:rounded-tr-2xl"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in transactionsStore.transactions"
              :key="row.id ?? i"
              class="border-t border-[#dbe7fb] bg-white transition hover:bg-[#fbfdff]"
            >
              <td
                v-for="col in tableColumns"
                :key="col.key"
                class="max-w-[200px] truncate px-3 py-2.5 text-[#333]"
                :title="String(getCellValue(row, col.key) ?? '')"
              >
                <a
                  v-if="isVoucherColumn(col.key) && getCellValue(row, col.key)"
                  :href="String(getCellValue(row, col.key))"
                  target="_blank"
                  rel="noopener"
                  class="text-[#066ac9] hover:underline"
                >
                  Ver
                </a>
                <span v-else>{{ formatCell(getCellValue(row, col.key)) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal Importar -->
    <Teleport to="body">
      <div
        v-if="showImportModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="showImportModal = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-[#dbe7fb] bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-semibold text-[#232b4d]">Importar desde Excel</h2>
          <div class="mb-4 rounded-lg bg-[#fbfdff] p-4 text-sm text-[#666]">
            <p class="mb-2 font-medium text-[#333]">Columnas del Excel (primera fila = encabezados):</p>
            <ul class="list-inside list-disc space-y-1">
              <li><strong>code</strong> (requerido) — Código único</li>
              <li><strong>origin_amount</strong> / monto_origen (requerido)</li>
              <li><strong>destination_amount</strong> / monto_destino (requerido)</li>
              <li><strong>send_date</strong> / fecha_envio (opcional)</li>
              <li><strong>payment_date</strong> / fecha_pago (opcional)</li>
              <li><strong>status</strong> / estado (opcional: pending, completed, failed)</li>
              <li><strong>send_voucher</strong> / voucher_envio (opcional: URL o imagen)</li>
              <li><strong>payment_voucher</strong> / voucher_pago (opcional: URL o imagen)</li>
            </ul>
          </div>
          <form class="space-y-4" @submit.prevent="submitImport">
            <div>
              <label class="mb-1 block text-sm font-medium text-[#333]">Archivo Excel (.xlsx)</label>
              <input
                ref="fileInput"
                type="file"
                accept=".xlsx,.xls"
                required
                class="w-full rounded-xl border border-[#cfdbef] px-4 py-2.5 text-sm"
                @change="importFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
              />
            </div>
            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="rounded-xl bg-gradient-to-r from-[#10b981] to-[#5ED6B3] px-4 py-2.5 text-sm font-semibold text-[#06271d] disabled:opacity-60"
                :disabled="transactionsStore.isImporting || !importFile"
              >
                {{ transactionsStore.isImporting ? 'Importando...' : 'Importar' }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-[#4A52D8]/30 px-4 py-2.5 text-sm text-[#3C4DA7] hover:bg-[#4A52D8]/10"
                @click="showImportModal = false"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTransactionsStore } from '@modules/transacciones/presentation/controllers/useTransactionsStore'
import type { Transaction } from '@modules/transacciones/domain/models'

const transactionsStore = useTransactionsStore()
const showImportModal = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const importFile = ref<File | null>(null)

const tableColumns = [
  { key: 'code', label: 'Código' },
  { key: 'origin_amount', label: 'Monto origen' },
  { key: 'destination_amount', label: 'Monto destino' },
  { key: 'send_date', label: 'Fecha envío' },
  { key: 'payment_date', label: 'Fecha pago' },
  { key: 'status', label: 'Estado' },
  { key: 'send_voucher', label: 'Voucher envío' },
  { key: 'payment_voucher', label: 'Voucher pago' }
]

/** Obtiene el valor de una celda soportando aliases (origin_amount | monto_origen, etc.) */
function getCellValue(row: Transaction, key: string): unknown {
  const aliases: Record<string, string[]> = {
    code: ['code', 'codigo', 'código'],
    origin_amount: ['origin_amount', 'monto_origen'],
    destination_amount: ['destination_amount', 'monto_destino'],
    send_date: ['send_date', 'fecha_envio'],
    payment_date: ['payment_date', 'fecha_pago'],
    status: ['status', 'estado'],
    send_voucher: ['send_voucher', 'voucher_envio'],
    payment_voucher: ['payment_voucher', 'voucher_pago']
  }
  const keys = aliases[key] ?? [key]
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return row[key]
}

function isVoucherColumn(key: string): boolean {
  return key === 'send_voucher' || key === 'payment_voucher'
}

function formatCell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value)
    return value.toFixed(4).replace(/\.?0+$/, '')
  }
  return String(value)
}

async function submitImport() {
  if (!importFile.value) return
  try {
    await transactionsStore.importExcel(importFile.value)
    showImportModal.value = false
    importFile.value = null
    if (fileInput.value) fileInput.value.value = ''
  } catch {
    // Error ya mostrado en store
  }
}

onMounted(() => {
  transactionsStore.loadTransactions()
})
</script>
