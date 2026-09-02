<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import { useAccountingCommissionSettingsStore } from '@modules/contabilidad/presentation/controllers/use_accounting_commission_settings_store'

defineOptions({ name: 'AccountingCommissionFixedSettings' })

const authStore = useAuthStore()
const settingsStore = useAccountingCommissionSettingsStore()

const canUpdate = computed(() => authStore.hasPermission('commissions.update'))

const amountThresholdInput = ref('')
const fixedCommissionInput = ref('')
const localError = ref('')
const savedFlash = ref(false)

function syncFromStore() {
  amountThresholdInput.value = String(settingsStore.settings.amountThreshold)
  fixedCommissionInput.value = String(settingsStore.settings.fixedCommission)
}

watch(
  () => settingsStore.settings,
  () => syncFromStore(),
  { deep: true }
)

onMounted(async () => {
  if (!settingsStore.hasLoadedOnce) {
    await settingsStore.loadSettings()
  }
  syncFromStore()
})

function parseInputNumber(raw: unknown): number {
  const text = String(raw ?? '')
    .trim()
    .replace(',', '.')
  return Number(text)
}

async function save(): Promise<void> {
  if (!canUpdate.value || settingsStore.isSaving) return
  localError.value = ''
  savedFlash.value = false

  const amountThreshold = parseInputNumber(amountThresholdInput.value)
  const fixedCommission = parseInputNumber(fixedCommissionInput.value)

  if (!Number.isFinite(amountThreshold) || amountThreshold <= 0) {
    localError.value = 'El umbral debe ser un número mayor a 0.'
    return
  }
  if (!Number.isFinite(fixedCommission) || fixedCommission < 0) {
    localError.value = 'La comisión fija debe ser un número mayor o igual a 0.'
    return
  }

  try {
    const ok = await settingsStore.saveSettings({ amountThreshold, fixedCommission })
    if (ok) {
      savedFlash.value = true
      window.setTimeout(() => {
        savedFlash.value = false
      }, 2500)
    }
  } catch (e) {
    localError.value =
      e instanceof Error ? e.message : 'No se pudieron guardar los settings de comisión'
  }
}
</script>

<template>
  <div class="mt-6 rounded-xl border border-[#dbe7fb] bg-[#f5f8ff] p-4">
    <div class="mb-3">
      <h2 class="text-base font-semibold text-[#232b4d]">Comisión fija bajo umbral</h2>
      <p class="mt-1 text-sm text-[#6b7280]">
        Si el monto de envío es menor al umbral, Contabilidad usa esta comisión fija en lugar del
        porcentaje del tramo. Los cambios aplican al cálculo de cada transacción.
      </p>
    </div>

    <div v-if="settingsStore.isLoading" class="text-sm text-[#666]">Cargando settings…</div>

    <template v-else>
      <p
        v-if="localError || settingsStore.error"
        class="mb-3 rounded-lg bg-[#dc3545]/10 px-3 py-2 text-sm text-[#dc3545]"
      >
        {{ localError || settingsStore.error }}
      </p>
      <p
        v-if="savedFlash"
        class="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      >
        Settings guardados.
      </p>

      <div class="flex flex-wrap items-end gap-4">
        <label class="flex min-w-[10rem] flex-col gap-1 text-sm">
          <span class="text-[11px] font-medium text-[#6b7280]">Umbral (monto de envío)</span>
          <input
            v-model="amountThresholdInput"
            type="number"
            min="1"
            step="1"
            :disabled="!canUpdate || settingsStore.isSaving"
            class="h-10 rounded-lg border border-[#cfdbef] bg-white px-3 text-sm text-[#374151] outline-none focus:border-brasper-indigoStrong focus:ring-1 focus:ring-brasper-indigoStrong disabled:bg-[#f3f4f6]"
          />
        </label>
        <label class="flex min-w-[10rem] flex-col gap-1 text-sm">
          <span class="text-[11px] font-medium text-[#6b7280]">Comisión fija (S/)</span>
          <input
            v-model="fixedCommissionInput"
            type="number"
            min="0"
            step="0.01"
            :disabled="!canUpdate || settingsStore.isSaving"
            class="h-10 rounded-lg border border-[#cfdbef] bg-white px-3 text-sm text-[#374151] outline-none focus:border-brasper-indigoStrong focus:ring-1 focus:ring-brasper-indigoStrong disabled:bg-[#f3f4f6]"
          />
        </label>
        <button
          v-if="canUpdate"
          type="button"
          class="h-10 rounded-lg bg-brasper-indigoStrong px-4 text-sm font-semibold text-white transition hover:bg-brasper-indigoDark disabled:opacity-60"
          :disabled="settingsStore.isSaving"
          @click="save"
        >
          {{ settingsStore.isSaving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </template>
  </div>
</template>
