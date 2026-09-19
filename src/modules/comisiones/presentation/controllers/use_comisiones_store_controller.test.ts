import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Commission } from '../../domain/models'

const { getMock, postMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn()
}))

vi.mock('@/interface/api/client', () => ({
  apiClient: {
    delete: vi.fn().mockResolvedValue({ data: null }),
    get: getMock,
    post: postMock,
    put: putMock
  }
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: {
    apiPath: (path: string) => path.replace(/^\/+|\/+$/g, '')
  }
}))

import {
  commissionToForm,
  emptyCommissionForm,
  useComisionesStore,
  type CommissionForm
} from './use_comisiones_store_controller'

function commission(overrides: Partial<Commission>): Commission {
  return {
    id: 'c',
    coin_a: 'PEN',
    coin_b: 'BRL',
    percentage: 2,
    reverse: '0',
    min_amount: 0,
    max_amount: 100,
    ...overrides
  }
}

/** Escalera PEN→BRL de tres tramos, el último abierto. */
const LADDER: Commission[] = [
  commission({ id: 'c1', percentage: 3, min_amount: 100, max_amount: 999 }),
  commission({ id: 'c2', percentage: 2.5, min_amount: 1000, max_amount: 4999 }),
  commission({ id: 'c3', percentage: 2, min_amount: 5000, max_amount: null })
]

function form(overrides: Partial<CommissionForm>): CommissionForm {
  return {
    ...emptyCommissionForm(),
    coin_a: 'PEN',
    coin_b: 'BRL',
    percentage: '1.5',
    reverse: '0',
    ...overrides
  }
}

describe('useComisionesStore · crear rangos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getMock.mockReset()
    postMock.mockReset().mockImplementation((_url: string, body: Record<string, unknown>) =>
      Promise.resolve({ data: { id: 'created', ...body } })
    )
    putMock.mockReset().mockImplementation((_url: string, body: Record<string, unknown>) =>
      Promise.resolve({ data: { ...body } })
    )
  })

  it('crea un tramo finito válido y lo agrega a la lista', async () => {
    const store = useComisionesStore()
    store.commissions = [LADDER[0]!]

    const ok = await store.validateAndCreateCommission(
      form({ min_amount: '1000', max_amount: '4999', percentage: '2.5' })
    )

    expect(ok).toBe(true)
    expect(store.error).toBeNull()
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock.mock.calls[0]![1]).toEqual({
      coin_a: 'PEN',
      coin_b: 'BRL',
      percentage: 2.5,
      reverse: '0',
      min_amount: 1000,
      max_amount: 4999
    })
    expect(store.commissions).toHaveLength(2)
    expect(store.commissions[1]?.id).toBe('created')
  })

  it('crea un tramo "sin límite" enviando max_amount null', async () => {
    const store = useComisionesStore()
    store.commissions = [LADDER[0]!, LADDER[1]!]

    const ok = await store.validateAndCreateCommission(
      form({ min_amount: '5000', max_amount: '', unlimited: true })
    )

    expect(ok).toBe(true)
    expect(postMock.mock.calls[0]![1]).toMatchObject({ min_amount: 5000, max_amount: null })
    expect(store.commissions[2]?.max_amount).toBeNull()
  })

  it('rechaza un tramo que se solapa con otro del mismo par, sin llamar al API', async () => {
    const store = useComisionesStore()
    store.commissions = [...LADDER]

    const ok = await store.validateAndCreateCommission(form({ min_amount: '4000', max_amount: '6000' }))

    expect(ok).toBe(false)
    expect(store.error).toMatch(/solapan/)
    expect(postMock).not.toHaveBeenCalled()
  })

  it('rechaza un segundo tramo abierto en el mismo par', async () => {
    const store = useComisionesStore()
    store.commissions = [...LADDER]

    const ok = await store.validateAndCreateCommission(form({ min_amount: '20000', unlimited: true }))

    expect(ok).toBe(false)
    expect(store.error).toMatch(/sin límite superior/)
    expect(postMock).not.toHaveBeenCalled()
  })

  it('no cruza la validación entre pares distintos', async () => {
    const store = useComisionesStore()
    store.commissions = [...LADDER]

    const ok = await store.validateAndCreateCommission(
      form({ coin_a: 'USD', coin_b: 'BRL', min_amount: '0', unlimited: true })
    )

    expect(ok).toBe(true)
    expect(postMock).toHaveBeenCalledTimes(1)
  })

  it('exige un máximo o marcar sin límite', async () => {
    const store = useComisionesStore()

    const ok = await store.validateAndCreateCommission(form({ min_amount: '100', max_amount: '' }))

    expect(ok).toBe(false)
    expect(store.error).toMatch(/monto máximo/)
  })

  it('rechaza máximo menor o igual al mínimo', async () => {
    const store = useComisionesStore()

    const ok = await store.validateAndCreateCommission(form({ min_amount: '500', max_amount: '500' }))

    expect(ok).toBe(false)
    expect(store.error).toMatch(/mayor que el mínimo/)
  })

  it('rechaza porcentaje vacío o negativo', async () => {
    const store = useComisionesStore()

    expect(await store.validateAndCreateCommission(form({ percentage: '', min_amount: '0', unlimited: true }))).toBe(false)
    expect(await store.validateAndCreateCommission(form({ percentage: '-1', min_amount: '0', unlimited: true }))).toBe(false)
    expect(postMock).not.toHaveBeenCalled()
  })

  it('refleja el error del API si el POST falla', async () => {
    postMock.mockRejectedValue(new Error('403 Forbidden'))
    const store = useComisionesStore()

    const ok = await store.validateAndCreateCommission(form({ min_amount: '0', unlimited: true }))

    expect(ok).toBe(false)
    expect(store.error).toBe('403 Forbidden')
    expect(store.savingId).toBeNull()
  })
})

describe('useComisionesStore · editar rangos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    putMock.mockReset().mockImplementation((_url: string, body: Record<string, unknown>) =>
      Promise.resolve({ data: { ...body } })
    )
  })

  it('editar el tramo abierto conserva max_amount null (antes lo guardaba como 0)', async () => {
    const store = useComisionesStore()
    store.commissions = [...LADDER]

    const edited = { ...commissionToForm(LADDER[2]!), percentage: '1.8' }
    const ok = await store.validateAndSaveCommission('c3', edited)

    expect(ok).toBe(true)
    expect(putMock.mock.calls[0]![1]).toMatchObject({ id: 'c3', percentage: 1.8, max_amount: null })
    expect(store.commissions.find((c) => c.id === 'c3')?.max_amount).toBeNull()
  })

  it('permite acotar el tramo abierto desmarcando sin límite', async () => {
    const store = useComisionesStore()
    store.commissions = [...LADDER]

    const ok = await store.validateAndSaveCommission('c3', {
      ...commissionToForm(LADDER[2]!),
      unlimited: false,
      max_amount: '9999'
    })

    expect(ok).toBe(true)
    expect(putMock.mock.calls[0]![1]).toMatchObject({ id: 'c3', max_amount: 9999 })
  })

  it('rechaza una edición que solape con un tramo vecino', async () => {
    const store = useComisionesStore()
    store.commissions = [...LADDER]

    const ok = await store.validateAndSaveCommission('c2', {
      ...commissionToForm(LADDER[1]!),
      min_amount: '900'
    })

    expect(ok).toBe(false)
    expect(store.error).toMatch(/solapan/)
    expect(putMock).not.toHaveBeenCalled()
  })

  it('no considera el propio tramo como vecino al validar', async () => {
    const store = useComisionesStore()
    store.commissions = [...LADDER]

    const ok = await store.validateAndSaveCommission('c2', {
      ...commissionToForm(LADDER[1]!),
      percentage: '2.2'
    })

    expect(ok).toBe(true)
  })

  it('devuelve false si la comisión no existe', async () => {
    const store = useComisionesStore()

    const ok = await store.validateAndSaveCommission('nope', form({ min_amount: '0', unlimited: true }))

    expect(ok).toBe(false)
    expect(store.error).toMatch(/No se encontró/)
  })
})

describe('commissionToForm', () => {
  it('marca unlimited cuando max_amount es null', () => {
    const f = commissionToForm(LADDER[2]!)
    expect(f.unlimited).toBe(true)
    expect(f.max_amount).toBe('')
  })

  it('deja unlimited en false para tramos finitos', () => {
    const f = commissionToForm(LADDER[0]!)
    expect(f.unlimited).toBe(false)
    expect(f.max_amount).toBe('999')
  })
})
