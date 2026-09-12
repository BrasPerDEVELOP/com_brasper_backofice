import { defineStore } from 'pinia'
import axios from 'axios'
import { formatApiErrorBody } from '@/interface/api/format_api_error'
import type {
  CreateTagPayload,
  TransactionTag,
  UpdateTagPayload
} from '../../domain/models'
import { TagsApiAdapter } from '../../infrastructure/adapters/tags_api_adapter'

let adapterSingleton: TagsApiAdapter | null = null

function getAdapter(): TagsApiAdapter {
  if (!adapterSingleton) adapterSingleton = new TagsApiAdapter()
  return adapterSingleton
}

function errorMessageFromCatch(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const fromBody = formatApiErrorBody(e.response?.data)
    if (fromBody) return fromBody
    if (e.message) return e.message
  }
  if (e instanceof Error) return e.message
  return fallback
}

/** Orden del catálogo: posición y, a igualdad, alfabético. */
function sortTags(items: TransactionTag[]): TransactionTag[] {
  return items
    .slice()
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
}

interface TagsState {
  tags: TransactionTag[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  hasLoadedOnce: boolean
}

export const useTagsStore = defineStore('transaction-tags', {
  state: (): TagsState => ({
    tags: [],
    isLoading: false,
    isSaving: false,
    error: null,
    hasLoadedOnce: false
  }),

  getters: {
    /** Las que se ofrecen al registrar un envío. */
    activeTags: (state): TransactionTag[] => state.tags.filter((t) => t.active),
    tagById:
      (state) =>
      (id: string): TransactionTag | undefined =>
        state.tags.find((t) => t.id === id),
    /** Todas las etiquetas que alimentan el conteo de clientes nuevos. */
    newClientTags: (state): TransactionTag[] =>
      state.tags.filter((t) => t.counts_as_new_client)
  },

  actions: {
    async loadTags(force = false) {
      if (this.hasLoadedOnce && !force && this.tags.length > 0) return
      this.isLoading = true
      this.error = null
      try {
        this.tags = sortTags(await getAdapter().getTags())
      } catch (e) {
        this.error = errorMessageFromCatch(e, 'Error al cargar etiquetas')
      } finally {
        this.hasLoadedOnce = true
        this.isLoading = false
      }
    },

    async createTag(payload: CreateTagPayload): Promise<TransactionTag> {
      this.isSaving = true
      this.error = null
      try {
        const created = await getAdapter().createTag(payload)
        this.tags = sortTags([...this.tags, created])
        return created
      } catch (e) {
        this.error = errorMessageFromCatch(e, 'Error al crear la etiqueta')
        throw e
      } finally {
        this.isSaving = false
      }
    },

    async updateTag(payload: UpdateTagPayload): Promise<TransactionTag> {
      this.isSaving = true
      this.error = null
      try {
        const updated = await getAdapter().updateTag(payload)
        const rest = this.tags.filter(
          (t) => t.id !== updated.id
        )
        this.tags = sortTags([...rest, updated])
        return updated
      } catch (e) {
        this.error = errorMessageFromCatch(e, 'Error al actualizar la etiqueta')
        throw e
      } finally {
        this.isSaving = false
      }
    },

    async deleteTag(id: string) {
      this.error = null
      try {
        await getAdapter().deleteTag(id)
        this.tags = this.tags.filter((t) => t.id !== id)
      } catch (e) {
        this.error = errorMessageFromCatch(e, 'Error al eliminar la etiqueta')
        throw e
      }
    }
  }
})
