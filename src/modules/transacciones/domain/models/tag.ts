/** Etiqueta del catálogo que ventas aplica a una transacción. */
export interface TransactionTag {
  id: string
  label: string
  /** Clave de la paleta cerrada; ver `TAG_COLOR_STYLES`. */
  color: TagColorKey
  /** Inactiva deja de ofrecerse al registrar, pero sigue en los envíos que ya la tenían. */
  active: boolean
  /** Solo una etiqueta puede tenerlo: es la que alimenta el conteo de clientes nuevos. */
  counts_as_new_client: boolean
  position: number
  created_at?: string
  updated_at?: string
}

export const TAG_COLOR_KEYS = [
  'amber',
  'blue',
  'purple',
  'rose',
  'green',
  'cyan',
  'orange',
  'slate'
] as const

export type TagColorKey = (typeof TAG_COLOR_KEYS)[number]

export interface TagColorStyle {
  /** Fondo del chip. */
  bg: string
  /** Color del texto. */
  fg: string
  /** Borde del chip. */
  bd: string
}

/**
 * Paleta cerrada compartida con el API (`TAG_COLORS`). Se fija aquí en vez de
 * permitir color libre para que ningún chip quede ilegible.
 */
export const TAG_COLOR_STYLES: Record<TagColorKey, TagColorStyle> = {
  amber: { bg: '#fef3c7', fg: '#92400e', bd: '#fcd34d' },
  blue: { bg: '#dbeafe', fg: '#1e40af', bd: '#93c5fd' },
  purple: { bg: '#f3e8ff', fg: '#6b21a8', bd: '#d8b4fe' },
  rose: { bg: '#ffe4e6', fg: '#9f1239', bd: '#fda4af' },
  green: { bg: '#d1fae5', fg: '#065f46', bd: '#6ee7b7' },
  cyan: { bg: '#cffafe', fg: '#155e75', bd: '#67e8f9' },
  orange: { bg: '#ffedd5', fg: '#9a3412', bd: '#fdba74' },
  slate: { bg: '#f1f5f9', fg: '#334155', bd: '#cbd5e1' }
}

export function tagColorStyle(color: string | undefined): TagColorStyle {
  const key = (color ?? '').trim().toLowerCase() as TagColorKey
  return TAG_COLOR_STYLES[key] ?? TAG_COLOR_STYLES.slate
}

export interface CreateTagPayload {
  label: string
  color: TagColorKey
  active: boolean
  counts_as_new_client: boolean
  position?: number
}

export interface UpdateTagPayload extends Partial<CreateTagPayload> {
  id: string
}
