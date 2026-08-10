import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { TransactionTag } from '../../domain/models'

const getTags = vi.fn()
const createTag = vi.fn()
const updateTag = vi.fn()
const deleteTag = vi.fn()

vi.mock('../../infrastructure/adapters/tags_api_adapter', () => ({
  TagsApiAdapter: class {
    getTags = getTags
    createTag = createTag
    updateTag = updateTag
    deleteTag = deleteTag
  }
}))

import { useTagsStore } from './use_tags_store_controller'

const tag = (over: Partial<TransactionTag> = {}): TransactionTag => ({
  id: 'g1',
  label: 'Cliente nuevo',
  color: 'amber',
  active: true,
  counts_as_new_client: false,
  position: 0,
  ...over
})

describe('catálogo de etiquetas', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getTags.mockReset()
    createTag.mockReset()
    updateTag.mockReset()
    deleteTag.mockReset()
  })

  it('ordena por posición y desempata alfabéticamente', async () => {
    getTags.mockResolvedValue([
      tag({ id: 'c', label: 'VIP', position: 2 }),
      tag({ id: 'b', label: 'Zeta', position: 1 }),
      tag({ id: 'a', label: 'Alfa', position: 1 })
    ])
    const store = useTagsStore()
    await store.loadTags()
    expect(store.tags.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('activeTags deja fuera las inactivas', async () => {
    getTags.mockResolvedValue([
      tag({ id: 'a', label: 'Activa' }),
      tag({ id: 'b', label: 'Inactiva', active: false })
    ])
    const store = useTagsStore()
    await store.loadTags()
    expect(store.activeTags.map((t) => t.id)).toEqual(['a'])
    // La inactiva sigue en el catálogo: los envíos viejos la conservan.
    expect(store.tags).toHaveLength(2)
  })

  it('newClientTag es null si ninguna tiene el flag', async () => {
    getTags.mockResolvedValue([tag({ id: 'a' })])
    const store = useTagsStore()
    await store.loadTags()
    expect(store.newClientTag).toBeNull()
  })

  it('no repite la carga salvo que se fuerce', async () => {
    getTags.mockResolvedValue([tag()])
    const store = useTagsStore()
    await store.loadTags()
    await store.loadTags()
    expect(getTags).toHaveBeenCalledTimes(1)
    await store.loadTags(true)
    expect(getTags).toHaveBeenCalledTimes(2)
  })

  it('al crear con el flag, ninguna otra sigue contando como nuevo', async () => {
    getTags.mockResolvedValue([
      tag({ id: 'vieja', label: 'Recurrente', counts_as_new_client: true })
    ])
    createTag.mockResolvedValue(
      tag({ id: 'nueva', label: 'Cliente nuevo', counts_as_new_client: true, position: 1 })
    )
    const store = useTagsStore()
    await store.loadTags()

    await store.createTag({
      label: 'Cliente nuevo',
      color: 'amber',
      active: true,
      counts_as_new_client: true
    })

    expect(store.newClientTag?.id).toBe('nueva')
    expect(store.tagById('vieja')?.counts_as_new_client).toBe(false)
  })

  it('al editar moviendo el flag, la anterior lo pierde', async () => {
    getTags.mockResolvedValue([
      tag({ id: 'a', label: 'Cliente nuevo', counts_as_new_client: true }),
      tag({ id: 'b', label: 'Recurrente', position: 1 })
    ])
    updateTag.mockResolvedValue(
      tag({ id: 'b', label: 'Recurrente', counts_as_new_client: true, position: 1 })
    )
    const store = useTagsStore()
    await store.loadTags()

    await store.updateTag({ id: 'b', counts_as_new_client: true })

    expect(store.newClientTag?.id).toBe('b')
    expect(store.tagById('a')?.counts_as_new_client).toBe(false)
    expect(store.tags).toHaveLength(2)
  })

  it('editar sin el flag no toca a las demás', async () => {
    getTags.mockResolvedValue([
      tag({ id: 'a', label: 'Cliente nuevo', counts_as_new_client: true }),
      tag({ id: 'b', label: 'Recurrente', position: 1 })
    ])
    updateTag.mockResolvedValue(tag({ id: 'b', label: 'Recurrentes', position: 1 }))
    const store = useTagsStore()
    await store.loadTags()

    await store.updateTag({ id: 'b', label: 'Recurrentes' })

    expect(store.newClientTag?.id).toBe('a')
  })

  it('borrar la saca del catálogo', async () => {
    getTags.mockResolvedValue([tag({ id: 'a' }), tag({ id: 'b', position: 1 })])
    deleteTag.mockResolvedValue(undefined)
    const store = useTagsStore()
    await store.loadTags()

    await store.deleteTag('a')

    expect(store.tags.map((t) => t.id)).toEqual(['b'])
  })

  it('un fallo de red deja mensaje y no rompe el catálogo', async () => {
    getTags.mockRejectedValue(new Error('Network Error'))
    const store = useTagsStore()
    await store.loadTags()
    expect(store.error).toBe('Network Error')
    expect(store.tags).toEqual([])
  })

  it('un fallo al crear propaga el error para que la UI no cierre el modal', async () => {
    getTags.mockResolvedValue([])
    createTag.mockRejectedValue(new Error('Ya existe una etiqueta llamada «X»'))
    const store = useTagsStore()
    await store.loadTags()

    await expect(
      store.createTag({ label: 'X', color: 'amber', active: true, counts_as_new_client: false })
    ).rejects.toThrow()
    expect(store.error).toContain('Ya existe')
    expect(store.isSaving).toBe(false)
  })
})
