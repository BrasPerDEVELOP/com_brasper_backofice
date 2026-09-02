import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import axios from 'axios'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import type { AccountingCommissionSettings } from '../../domain/models/accounting_commission_settings'
import type { AccountingCommissionFixedRule } from '../../domain/accounting_commission'
import {
  ACCOUNTING_COMMISSION_FALLBACK_FIXED,
  ACCOUNTING_COMMISSION_FALLBACK_THRESHOLD
} from '../../domain/accounting_commission'
import { AccountingCommissionSettingsApiAdapter } from '../../infrastructure/adapters/accounting_commission_settings_api_adapter'

const adapter = new AccountingCommissionSettingsApiAdapter()

function fallbackSettings(): AccountingCommissionSettings {
  return {
    amountThreshold: ACCOUNTING_COMMISSION_FALLBACK_THRESHOLD,
    fixedCommission: ACCOUNTING_COMMISSION_FALLBACK_FIXED
  }
}

function settingsErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status
    const body = formatApiErrorBody(e.response?.data)
    if (body) return status ? `(${status}) ${body}` : body
    if (status === 404) {
      return 'El endpoint de settings no existe en el API (¿falta desplegar el backend?).'
    }
    if (status === 403) {
      return 'No tienes permiso para editar comisiones (commissions.update).'
    }
    if (status === 500) {
      return 'Error del servidor al guardar. Revisa si la migración 076 está aplicada.'
    }
    return e.message || fallback
  }
  if (e instanceof Error && e.message) return e.message
  return fallback
}

export const useAccountingCommissionSettingsStore = defineStore(
  'accounting-commission-settings',
  () => {
    const settings = ref<AccountingCommissionSettings>(fallbackSettings())
    const isLoading = ref(false)
    const isSaving = ref(false)
    const error = ref<string | null>(null)
    const hasLoadedOnce = ref(false)

    const fixedRule = computed((): AccountingCommissionFixedRule => ({
      amountThreshold: settings.value.amountThreshold,
      fixedCommission: settings.value.fixedCommission
    }))

    async function loadSettings(): Promise<void> {
      if (isLoading.value) return
      isLoading.value = true
      error.value = null
      try {
        settings.value = await adapter.getSettings()
        hasLoadedOnce.value = true
      } catch (e) {
        error.value = settingsErrorMessage(
          e,
          'No se pudieron cargar los settings de comisión'
        )
        // Se mantienen fallbacks para no romper la tabla de Contabilidad.
        hasLoadedOnce.value = true
      } finally {
        isLoading.value = false
      }
    }

    async function saveSettings(next: AccountingCommissionSettings): Promise<boolean> {
      if (isSaving.value) return false
      isSaving.value = true
      error.value = null
      try {
        settings.value = await adapter.saveSettings(next)
        return true
      } catch (e) {
        error.value = settingsErrorMessage(
          e,
          'No se pudieron guardar los settings de comisión'
        )
        return false
      } finally {
        isSaving.value = false
      }
    }

    return {
      settings,
      fixedRule,
      isLoading,
      isSaving,
      error,
      hasLoadedOnce,
      loadSettings,
      saveSettings
    }
  }
)
