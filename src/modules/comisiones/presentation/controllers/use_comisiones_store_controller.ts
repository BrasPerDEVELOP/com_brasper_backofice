import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Commission, CommissionHistoryEntry, CommissionResource } from '../../domain/models'
import type { ComisionesRepository, CommissionUpdateBody } from '../../infrastructure/adapters/comisiones_repository'
import { ComisionesApiAdapter } from '../../infrastructure/adapters'
import {
  GetCommissionsUseCase,
  GetCommissionHistoryUseCase,
  CreateCommissionUseCase,
  UpdateCommissionUseCase,
  DeleteCommissionUseCase
} from '../../application/use_cases'

/** Formulario de comisión: todos los campos como texto, tal cual los edita la vista. */
export interface CommissionForm {
  coin_a: string
  coin_b: string
  percentage: string
  reverse: string
  min_amount: string
  max_amount: string
}

/**
 * Contrato que consume la UI de comisiones. Lo cumplen tanto el store de venta
 * como el de contabilidad: son la misma definición sobre recursos distintos,
 * pero Pinia les da tipos distintos por el id, así que los componentes
 * compartidos tipan contra esta interfaz.
 */
export interface ComisionesStoreLike {
  commissions: Commission[]
  isLoading: boolean
  error: string | null
  savingId: string | null
  deletingId: string | null
  loadingHistoryId: string | null
  historyByCommissionId: Record<string, CommissionHistoryEntry[]>
  loadCommissions(): Promise<void>
  deleteCommission(id: string): Promise<void>
  loadCommissionHistory(id: string, force?: boolean): Promise<void>
  validateAndSaveCommission(id: string, form: CommissionForm): Promise<boolean>
}

/**
 * Define el store de comisiones sobre un recurso del API. La lógica es idéntica
 * para venta y contabilidad; lo único que cambia es a qué endpoint pega.
 */
function buildComisionesStore(resource: CommissionResource) {
  return () => {
    const repository: ComisionesRepository = new ComisionesApiAdapter(resource)

    const commissions = ref<Commission[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const savingId = ref<string | null>(null)
    const deletingId = ref<string | null>(null)
    const loadingHistoryId = ref<string | null>(null)
    const historyByCommissionId = ref<Record<string, CommissionHistoryEntry[]>>({})

    async function loadCommissions(): Promise<void> {
      isLoading.value = true
      error.value = null
      try {
        commissions.value = await new GetCommissionsUseCase(repository).execute()
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Error al cargar comisiones'
      } finally {
        isLoading.value = false
      }
    }

    async function createCommission(payload: CommissionForm): Promise<void> {
      savingId.value = 'new'
      error.value = null
      try {
        const created = await new CreateCommissionUseCase(repository).execute(payload)
        commissions.value.push(created)
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Error al crear comisión'
      } finally {
        savingId.value = null
      }
    }

    async function updateCommission(id: string, body: CommissionUpdateBody): Promise<void> {
      savingId.value = id
      error.value = null
      try {
        const updated = await new UpdateCommissionUseCase(repository).execute(id, body)
        const idx = commissions.value.findIndex((c) => c.id === id)
        if (idx >= 0) commissions.value[idx] = updated
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Error al actualizar comisión'
      } finally {
        savingId.value = null
      }
    }

    async function deleteCommission(id: string): Promise<void> {
      deletingId.value = id
      error.value = null
      try {
        await new DeleteCommissionUseCase(repository).execute(id)
        commissions.value = commissions.value.filter((c) => c.id !== id)
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Error al eliminar comisión'
      } finally {
        deletingId.value = null
      }
    }

    /**
     * Solo el recurso de venta expone historial; la vista de contabilidad no
     * muestra el botón, así que esta acción no debería llamarse ahí.
     */
    async function loadCommissionHistory(id: string, force = false): Promise<void> {
      if (!force && historyByCommissionId.value[id]) return
      loadingHistoryId.value = id
      error.value = null
      try {
        const history = await new GetCommissionHistoryUseCase(repository).execute(id)
        historyByCommissionId.value = { ...historyByCommissionId.value, [id]: history }
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Error al cargar historial de comisión'
      } finally {
        loadingHistoryId.value = null
      }
    }

    /**
     * Valida el formulario y actualiza la comisión. El controlador centraliza
     * la validación para evitar mutaciones directas del estado desde las vistas.
     * @returns true si se guardó correctamente (sin error)
     */
    async function validateAndSaveCommission(id: string, form: CommissionForm): Promise<boolean> {
      const current = commissions.value.find((c) => c.id === id)
      if (!current) {
        error.value = 'No se encontró la comisión a editar.'
        return false
      }

      const coinA = form.coin_a.trim().toUpperCase()
      const coinB = form.coin_b.trim().toUpperCase()
      const percentage = Number(form.percentage.trim())
      const minAmount = Number(form.min_amount.trim()) || 0
      const maxAmount = Number(form.max_amount.trim()) || 0

      if (!coinA || !coinB) {
        error.value = 'Monedas inválidas para la comisión.'
        return false
      }

      if (percentage < 0 || Number.isNaN(percentage)) {
        error.value = 'El porcentaje debe ser un número válido.'
        return false
      }

      await updateCommission(id, {
        id: current.id,
        coin_a: coinA,
        coin_b: coinB,
        percentage,
        reverse: form.reverse.trim(),
        min_amount: minAmount,
        max_amount: maxAmount,
        created_at: current.created_at,
        created_by: current.created_by ?? null,
        updated_at: current.updated_at
      })
      return !error.value
    }

    return {
      commissions,
      isLoading,
      error,
      savingId,
      deletingId,
      loadingHistoryId,
      historyByCommissionId,
      loadCommissions,
      createCommission,
      updateCommission,
      deleteCommission,
      loadCommissionHistory,
      validateAndSaveCommission
    }
  }
}

/** Comisiones de venta (`/coin/commission`). */
export const useComisionesStore = defineStore('comisiones', buildComisionesStore('commission'))

/** Comisiones de contabilidad (`/coin/commission-accounting`). */
export const useComisionesContabilidadStore = defineStore(
  'comisiones-contabilidad',
  buildComisionesStore('commission-accounting')
)
