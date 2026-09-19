import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Commission, CommissionHistoryEntry, CommissionResource } from '../../domain/models'
import { validateRanges } from '../../domain/commission_ranges'
import type {
  ComisionesRepository,
  CommissionCreateBody,
  CommissionUpdateBody
} from '../../infrastructure/adapters/comisiones_repository'
import { ComisionesApiAdapter } from '../../infrastructure/adapters'
import {
  GetCommissionsUseCase,
  GetCommissionHistoryUseCase,
  CreateCommissionUseCase,
  UpdateCommissionUseCase,
  DeleteCommissionUseCase
} from '../../application/use_cases'

/**
 * Formulario de comisión: todos los campos como texto, tal cual los edita la vista.
 * `unlimited` marca el tramo "a más": se ignora `max_amount` y se envía `null`.
 */
export interface CommissionForm {
  coin_a: string
  coin_b: string
  percentage: string
  reverse: string
  min_amount: string
  max_amount: string
  unlimited: boolean
}

/** Formulario vacío, para iniciar creación o limpiar edición. */
export function emptyCommissionForm(): CommissionForm {
  return {
    coin_a: '',
    coin_b: '',
    percentage: '',
    reverse: '0',
    min_amount: '',
    max_amount: '',
    unlimited: false
  }
}

/** Formulario a partir de una comisión existente (para editar). */
export function commissionToForm(commission: Commission): CommissionForm {
  return {
    coin_a: commission.coin_a,
    coin_b: commission.coin_b,
    percentage: String(commission.percentage),
    reverse: commission.reverse,
    min_amount: String(commission.min_amount),
    max_amount: commission.max_amount == null ? '' : String(commission.max_amount),
    unlimited: commission.max_amount == null
  }
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
  validateAndCreateCommission(form: CommissionForm): Promise<boolean>
  validateAndSaveCommission(id: string, form: CommissionForm): Promise<boolean>
}

type ParsedForm = { ok: true; body: CommissionCreateBody } | { ok: false; error: string }

/** Convierte el formulario de texto en el body del API, validando campo a campo. */
function parseCommissionForm(form: CommissionForm): ParsedForm {
  const coinA = form.coin_a.trim().toUpperCase()
  const coinB = form.coin_b.trim().toUpperCase()
  if (!coinA || !coinB) return { ok: false, error: 'Monedas inválidas para la comisión.' }
  if (coinA === coinB) return { ok: false, error: 'La moneda origen y destino deben ser distintas.' }

  const percentage = Number(form.percentage.trim())
  if (form.percentage.trim() === '' || Number.isNaN(percentage) || percentage < 0) {
    return { ok: false, error: 'El porcentaje debe ser un número válido mayor o igual a 0.' }
  }

  const minAmount = Number(form.min_amount.trim())
  if (form.min_amount.trim() === '' || Number.isNaN(minAmount) || minAmount < 0) {
    return { ok: false, error: 'El monto mínimo debe ser un número válido mayor o igual a 0.' }
  }

  let maxAmount: number | null = null
  if (!form.unlimited) {
    const raw = form.max_amount.trim()
    if (raw === '') {
      return { ok: false, error: 'Indica un monto máximo o marca el tramo como "sin límite".' }
    }
    maxAmount = Number(raw)
    if (Number.isNaN(maxAmount) || maxAmount <= minAmount) {
      return { ok: false, error: 'El monto máximo debe ser un número mayor que el mínimo.' }
    }
  }

  const reverse = form.reverse.trim() === '' ? '0' : form.reverse.trim()
  if (Number.isNaN(Number(reverse))) {
    return { ok: false, error: 'El valor de reverse debe ser numérico.' }
  }

  return {
    ok: true,
    body: { coin_a: coinA, coin_b: coinB, percentage, reverse, min_amount: minAmount, max_amount: maxAmount }
  }
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

    async function createCommission(payload: CommissionCreateBody): Promise<boolean> {
      savingId.value = 'new'
      error.value = null
      try {
        const created = await new CreateCommissionUseCase(repository).execute(payload)
        commissions.value.push(created)
        return true
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Error al crear comisión'
        return false
      } finally {
        savingId.value = null
      }
    }

    async function updateCommission(id: string, body: CommissionUpdateBody): Promise<boolean> {
      savingId.value = id
      error.value = null
      try {
        const updated = await new UpdateCommissionUseCase(repository).execute(id, body)
        const idx = commissions.value.findIndex((c) => c.id === id)
        if (idx >= 0) commissions.value[idx] = updated
        return true
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Error al actualizar comisión'
        return false
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
     * Valida la escalera del par con el tramo candidato ya aplicado. Solapes,
     * más de un tramo abierto o un tramo abierto que no sea el último bloquean;
     * los huecos solo se avisan en la vista, así que aquí no se consideran.
     * @returns mensaje de error o `null` si la escalera es válida
     */
    function rangeErrorForPair(candidate: CommissionCreateBody, candidateId: string): string | null {
      const siblings = commissions.value.filter(
        (c) => c.id !== candidateId && c.coin_a === candidate.coin_a && c.coin_b === candidate.coin_b
      )
      const result = validateRanges([
        ...siblings,
        { id: candidateId, min_amount: candidate.min_amount, max_amount: candidate.max_amount }
      ])
      return result.isValid ? null : result.errors.map((issue) => issue.message).join(' ')
    }

    /**
     * Valida el formulario y crea un tramo nuevo. El controlador centraliza la
     * validación para evitar mutaciones directas del estado desde las vistas.
     * @returns true si se creó correctamente (sin error)
     */
    async function validateAndCreateCommission(form: CommissionForm): Promise<boolean> {
      const parsed = parseCommissionForm(form)
      if (!parsed.ok) {
        error.value = parsed.error
        return false
      }
      const rangeError = rangeErrorForPair(parsed.body, 'new')
      if (rangeError) {
        error.value = rangeError
        return false
      }
      return createCommission(parsed.body)
    }

    /**
     * Valida el formulario y actualiza la comisión.
     * @returns true si se guardó correctamente (sin error)
     */
    async function validateAndSaveCommission(id: string, form: CommissionForm): Promise<boolean> {
      const current = commissions.value.find((c) => c.id === id)
      if (!current) {
        error.value = 'No se encontró la comisión a editar.'
        return false
      }

      const parsed = parseCommissionForm(form)
      if (!parsed.ok) {
        error.value = parsed.error
        return false
      }
      const rangeError = rangeErrorForPair(parsed.body, id)
      if (rangeError) {
        error.value = rangeError
        return false
      }

      return updateCommission(id, {
        ...parsed.body,
        id: current.id,
        created_at: current.created_at,
        created_by: current.created_by,
        updated_at: current.updated_at
      })
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
      validateAndCreateCommission,
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
