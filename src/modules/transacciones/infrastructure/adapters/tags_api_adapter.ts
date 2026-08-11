import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  CreateTagPayload,
  TagColorKey,
  TransactionTag,
  UpdateTagPayload
} from '../../domain/models'
import { TAG_COLOR_KEYS } from '../../domain/models'

function parseColor(value: unknown): TagColorKey {
  const key = String(value ?? '').trim().toLowerCase() as TagColorKey
  return TAG_COLOR_KEYS.includes(key) ? key : 'slate'
}

/** Normaliza el registro del API; absorbe nombres alternos como en el resto del módulo. */
export function tagFromApiRecord(raw: unknown): TransactionTag {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(o.id ?? ''),
    label: String(o.label ?? o.name ?? '').trim(),
    color: parseColor(o.color),
    active: o.active !== false,
    counts_as_new_client:
      o.counts_as_new_client === true || o.countsAsNewClient === true,
    position: Number(o.position ?? 0) || 0,
    created_at: o.created_at != null ? String(o.created_at) : undefined,
    updated_at: o.updated_at != null ? String(o.updated_at) : undefined
  }
}

function endpoint(path = ''): string {
  const p = path.replace(/^\/+/, '')
  return p ? Domain.apiPath(`transactions/tags/${p}`) : Domain.apiPath('transactions/tags')
}

export class TagsApiAdapter {
  async getTags(onlyActive = false): Promise<TransactionTag[]> {
    const url = onlyActive ? `${endpoint()}?only_active=true` : endpoint()
    const { data } = await apiClient.get(url)
    const items = Array.isArray(data) ? data : (data?.items ?? [])
    return (items as unknown[]).map(tagFromApiRecord)
  }

  async createTag(payload: CreateTagPayload): Promise<TransactionTag> {
    const { data } = await apiClient.post(endpoint(), payload)
    return tagFromApiRecord(data)
  }

  /** El API espera el `id` en el cuerpo, no en la ruta (mismo criterio que transacciones). */
  async updateTag(payload: UpdateTagPayload): Promise<TransactionTag> {
    const { data } = await apiClient.put(endpoint(), payload)
    return tagFromApiRecord(data)
  }

  async deleteTag(id: string): Promise<void> {
    await apiClient.delete(endpoint(id))
  }
}
