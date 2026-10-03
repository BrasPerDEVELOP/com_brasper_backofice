<script setup lang="ts">
/**
 * Egresos de la empresa (en soles) y tasas mensuales a soles.
 * Alimentan la pestaña Resultados y los gráficos en soles del panel gerencial.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import { ConfirmDialog, PageHeader } from '@interface/widgets'
import { MONTH_LABELS_ES, todayIsoDate, type Expense, type FxRateInput } from '../../domain/models'
import FxRatesPanel from '../components/FxRatesPanel.vue'
import { useEgresosStore } from '../controllers/use_egresos_store_controller'

defineOptions({ name: 'EgresosView' })

type Tab = 'egresos' | 'tasas'

const authStore = useAuthStore()
const store = useEgresosStore()
const route = useRoute()
const router = useRouter()

const canViewExpenses = computed(() => authStore.hasPermission('expenses.view'))
const canCreate = computed(() => authStore.hasPermission('expenses.create'))
const canUpdate = computed(() => authStore.hasPermission('expenses.update'))
const canDelete = computed(() => authStore.hasPermission('expenses.delete'))
const canViewRates = computed(() => authStore.hasPermission('fx_rates.view'))
const canEditRates = computed(() => authStore.hasPermission('fx_rates.update'))

const tabs = computed(() =>
  [
    canViewExpenses.value ? { key: 'egresos' as Tab, label: 'Egresos' } : null,
    canViewRates.value ? { key: 'tasas' as Tab, label: 'Tasas a soles' } : null
  ].filter((t): t is { key: Tab; label: string } => t !== null)
)
const activeTab = ref<Tab>(
  route.query.tab === 'tasas' && canViewRates.value ? 'tasas' : (tabs.value[0]?.key ?? 'egresos')
)
watch(activeTab, (tab) => {
  void router.replace({ query: { ...route.query, tab: tab === 'egresos' ? undefined : tab } })
})

const years = computed(() => {
  const current = new Date().getFullYear()
  const list: number[] = []
  for (let y = Math.max(current, store.year); y >= 2024; y -= 1) list.push(y)
  return list
})

function onYear(event: Event) {
  void store.setPeriod(Number((event.target as HTMLSelectElement).value), store.month)
}
function onMonth(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  void store.setPeriod(store.year, value >= 1 && value <= 12 ? value : null)
}

// --- Modal crear / editar ---------------------------------------------
const showModal = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const form = reactive({ expenseDate: todayIsoDate(), categoryId: '', description: '', amount: '' })
const modalTitle = computed(() => (editingId.value ? 'Editar egreso' : 'Nuevo egreso'))

function openCreate() {
  editingId.value = null
  formError.value = ''
  form.expenseDate = todayIsoDate()
  form.categoryId = store.categories[0]?.id ?? ''
  form.description = ''
  form.amount = ''
  showModal.value = true
}

function openEdit(expense: Expense) {
  editingId.value = expense.id
  formError.value = ''
  form.expenseDate = expense.expenseDate
  form.categoryId = expense.categoryId
  form.description = expense.description ?? ''
  form.amount = String(expense.amountPen)
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function submit() {
  const amount = Number(form.amount.replace(',', '.'))
  if (!form.expenseDate) {
    formError.value = 'La fecha es obligatoria.'
    return
  }
  if (!form.categoryId) {
    formError.value = 'Elige una categoría.'
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    formError.value = 'El monto debe ser mayor que cero.'
    return
  }
  formError.value = ''
  const input = {
    expenseDate: form.expenseDate,
    categoryId: form.categoryId,
    description: form.description.trim() || null,
    amountPen: Math.round(amount * 100) / 100
  }
  try {
    if (editingId.value) await store.updateExpense(editingId.value, input)
    else await store.createExpense(input)
    closeModal()
  } catch {
    formError.value = store.error ?? 'No se pudo guardar el egreso.'
  }
}

// --- Borrado ---------------------------------------------------------------
const showDeleteConfirm = ref(false)
const pendingDelete = ref<Expense | null>(null)
const deleting = ref(false)
const deleteMessage = computed(() =>
  pendingDelete.value
    ? `Se eliminará el egreso de ${formatPen(pendingDelete.value.amountPen)} (${pendingDelete.value.categoryName}, ${formatDate(pendingDelete.value.expenseDate)}).`
    : ''
)

function askDelete(expense: Expense) {
  pendingDelete.value = expense
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  const expense = pendingDelete.value
  if (!expense) return
  deleting.value = true
  try {
    await store.deleteExpense(expense.id)
    showDeleteConfirm.value = false
    pendingDelete.value = null
  } catch {
    // El store ya dejó el mensaje visible.
  } finally {
    deleting.value = false
  }
}

// --- Tasas -----------------------------------------------------------------
const ratesSaved = ref(false)
async function saveRates(items: FxRateInput[]) {
  ratesSaved.value = false
  try {
    await store.saveFxRates(items)
    ratesSaved.value = true
  } catch {
    // El store ya dejó el mensaje visible.
  }
}

function formatPen(value: number): string {
  return `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

onMounted(async () => {
  await Promise.all([store.loadCategories(), store.setPeriod(store.year, store.month)])
})
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-[#d8e5fb] bg-white p-6 shadow-lg shadow-brasper-indigoStrong/10">
      <PageHeader
        eyebrow="Contabilidad"
        title="Egresos y tasas a soles"
        subtitle="Gastos de la empresa y tasas de conversión mensual que alimentan el panel gerencial."
      >
        <template #actions>
          <label class="flex items-center gap-2 text-sm text-[#374151]">
            <span class="font-medium">Año</span>
            <select
              :value="store.year"
              :disabled="store.isLoading"
              class="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
              @change="onYear"
            >
              <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
            </select>
          </label>
        </template>
      </PageHeader>

      <div v-if="tabs.length > 1" class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          :class="[
            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.key
              ? 'border-brasper-indigoStrong bg-brasper-indigoStrong text-white'
              : 'border-[#cfdbef] bg-white text-[#666] hover:bg-[#f3f8ff] hover:text-[#232b4d]'
          ]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-if="store.error && !showModal"
        class="mt-4 rounded-lg bg-[#dc3545]/10 px-4 py-3 text-sm text-[#dc3545]"
        role="alert"
      >
        {{ store.error }}
      </div>

      <!-- Egresos -->
      <div v-if="activeTab === 'egresos' && canViewExpenses" class="mt-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3 text-sm text-[#374151]">
            <label class="flex items-center gap-2">
              <span class="font-medium">Mes</span>
              <select
                :value="store.month ?? ''"
                :disabled="store.isLoading"
                class="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
                @change="onMonth"
              >
                <option value="">Todo el año</option>
                <option v-for="month in 12" :key="month" :value="month">
                  {{ MONTH_LABELS_ES[month - 1] }}
                </option>
              </select>
            </label>
            <span class="rounded-full bg-[#f3f8ff] px-3 py-1 text-xs font-semibold text-brasper-indigoDark">
              Total: {{ formatPen(store.totalPen) }}
            </span>
          </div>
          <button
            v-if="canCreate"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            @click="openCreate"
          >
            + Nuevo egreso
          </button>
        </div>

        <div class="overflow-x-auto rounded-xl border border-[#e5e7eb] bg-white">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr class="bg-[#dbeafe]">
                <th class="px-4 py-3 font-semibold text-brasper-indigoDark">Fecha</th>
                <th class="px-4 py-3 font-semibold text-brasper-indigoDark">Categoría</th>
                <th class="px-4 py-3 font-semibold text-brasper-indigoDark">Descripción</th>
                <th class="px-4 py-3 text-right font-semibold text-brasper-indigoDark">Monto (S/)</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="store.isLoading && !store.expenses.length">
                <td colspan="5" class="px-4 py-10 text-center text-[#9ca3af]">Cargando egresos…</td>
              </tr>
              <tr v-else-if="!store.expenses.length">
                <td colspan="5" class="px-4 py-10 text-center text-[#9ca3af]">
                  No hay egresos registrados en este periodo.
                </td>
              </tr>
              <tr
                v-for="expense in store.expenses"
                :key="expense.id"
                class="border-t border-[#e5e7eb] transition hover:bg-[#f9fafb]"
              >
                <td class="whitespace-nowrap px-4 py-3">{{ formatDate(expense.expenseDate) }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-[11px] font-semibold text-brasper-indigoDark">
                    {{ expense.categoryName }}
                  </span>
                </td>
                <td class="px-4 py-3 text-[#374151]">{{ expense.description || '—' }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right font-medium">{{ formatPen(expense.amountPen) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs text-[#374151] transition hover:bg-[#f9fafb]"
                    @click="openEdit(expense)"
                  >
                    Editar
                  </button>
                  <button
                    v-if="canDelete"
                    type="button"
                    class="ml-2 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs text-[#b91c1c] transition hover:bg-[#fef2f2]"
                    @click="askDelete(expense)"
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tasas -->
      <div v-else-if="activeTab === 'tasas' && canViewRates" class="mt-5">
        <p v-if="ratesSaved" class="mb-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Tasas guardadas.
        </p>
        <FxRatesPanel
          :year="store.year"
          :rates="store.fxRates"
          :can-edit="canEditRates"
          :saving="store.isSaving"
          @save="saveRates"
        />
      </div>
    </section>

    <!-- Modal crear / editar egreso -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
        @click.self="closeModal"
      >
        <div class="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div class="border-b border-[#eef2f7] px-6 py-4">
            <h2 class="text-lg font-semibold text-[#232b4d]">{{ modalTitle }}</h2>
          </div>
          <form class="space-y-5 px-6 py-5" @submit.prevent="submit">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Fecha <span class="text-[#dc2626]">*</span>
              </label>
              <input
                v-model="form.expenseDate"
                type="date"
                required
                class="w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Categoría <span class="text-[#dc2626]">*</span>
              </label>
              <select
                v-model="form.categoryId"
                class="w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
              >
                <option v-for="category in store.categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">
                Monto en soles <span class="text-[#dc2626]">*</span>
              </label>
              <input
                v-model="form.amount"
                type="text"
                inputmode="decimal"
                placeholder="0.00"
                class="w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-[#374151]">Descripción</label>
              <input
                v-model="form.description"
                type="text"
                maxlength="500"
                placeholder="Sueldos de julio"
                class="w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-sm focus:border-brasper-indigoStrong focus:outline-none focus:ring-1 focus:ring-brasper-indigoStrong"
              />
            </div>

            <p v-if="formError" class="text-sm text-[#dc3545]">{{ formError }}</p>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm text-[#374151] transition hover:bg-[#f9fafb]"
                @click="closeModal"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="store.isSaving"
                class="rounded-lg bg-brasper-indigoStrong px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {{ store.isSaving ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="Eliminar egreso"
      :message="deleteMessage"
      confirm-text="Eliminar"
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </div>
</template>
