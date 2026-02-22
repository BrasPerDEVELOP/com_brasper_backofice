import { env } from '@/interface/config/env'
import { useAuthStore } from '../controllers/useAuthStore'
import type { User } from '../../domain/models'

const REQUIRED_QUERY_KEYS = ['data', 'iv', 'salt', 'v'] as const
const PBKDF2_ITERATIONS = 120000
const AES_KEY_LENGTH = 256
const REQUIRED_IV_LENGTH = 12
const REQUIRED_SALT_LENGTH = 16

type SsoPayload = {
  token: string
  user: unknown
  issuedAt: number | string
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['decrypt']
  )
}

function normalizeIssuedAt(value: number | string): number {
  if (typeof value === 'number') return value < 1_000_000_000_000 ? value * 1000 : value
  const asNumber = Number(value)
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber < 1_000_000_000_000 ? asNumber * 1000 : asNumber
  }
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function normalizeUser(raw: unknown): User {
  if (raw == null || typeof raw !== 'object') throw new Error('Usuario SSO inválido.')
  const o = raw as Record<string, unknown>
  const id = o.id ?? o.user_id
  const email = o.email ?? o.username
  if (id == null || email == null) throw new Error('Usuario SSO incompleto.')
  const names = o.names != null ? String(o.names) : null
  const lastnames = o.lastnames != null ? String(o.lastnames) : null
  const emailValue = String(email)
  const name = [names, lastnames].filter(Boolean).join(' ') || emailValue
  const phoneVal = o.phone ?? o.telefono
  const phone = typeof phoneVal === 'number' ? phoneVal : (typeof phoneVal === 'string' && phoneVal ? Number(phoneVal) : null)
  return {
    id: String(id),
    email: emailValue,
    names,
    lastnames,
    name,
    document_number: o.document_number != null ? String(o.document_number) : null,
    document_type: o.document_type != null ? String(o.document_type) : null,
    profile_image: o.profile_image != null ? String(o.profile_image) : null,
    is_agent: Boolean(o.is_agent),
    role: o.role != null ? String(o.role) : null,
    phone: Number.isFinite(phone) ? phone : null,
    code_phone: o.code_phone != null ? String(o.code_phone) : null
  }
}

async function decryptPayload(secret: string, data: string, iv: string, salt: string): Promise<SsoPayload> {
  const encrypted = decodeBase64Url(data)
  const ivBytes = decodeBase64Url(iv)
  const saltBytes = decodeBase64Url(salt)
  if (ivBytes.length !== REQUIRED_IV_LENGTH) throw new Error('IV SSO inválido.')
  if (saltBytes.length !== REQUIRED_SALT_LENGTH) throw new Error('Salt SSO inválido.')
  const key = await deriveKey(secret, saltBytes)
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, encrypted)
  const text = new TextDecoder().decode(plainBuffer)
  const parsed = JSON.parse(text) as Partial<SsoPayload>
  if (!parsed || typeof parsed !== 'object') throw new Error('Payload SSO inválido.')
  if (typeof parsed.token !== 'string' || !parsed.token.trim()) throw new Error('Token SSO inválido.')
  if (parsed.user == null) throw new Error('Usuario SSO faltante.')
  if (parsed.issuedAt == null) throw new Error('issuedAt faltante.')
  return { token: parsed.token, user: parsed.user, issuedAt: parsed.issuedAt }
}

export function useAdminSso() {
  const authStore = useAuthStore()

  async function processFromQuery(search: URLSearchParams): Promise<boolean> {
    const hasSsoSignal = REQUIRED_QUERY_KEYS.some((key) => search.has(key))
    if (!hasSsoSignal) return false

    const missing = REQUIRED_QUERY_KEYS.filter((key) => !search.get(key))
    if (missing.length > 0) throw new Error('SSO inválido o expirado.')

    if (!env.adminRedirectSecret) {
      throw new Error('Falta configurar VITE_ADMIN_REDIRECT_SECRET en esta app.')
    }

    const data = search.get('data') as string
    const iv = search.get('iv') as string
    const salt = search.get('salt') as string
    const payload = await decryptPayload(env.adminRedirectSecret, data, iv, salt)

    const issuedAt = normalizeIssuedAt(payload.issuedAt)
    const maxAgeMs = env.adminSsoMaxAgeSeconds * 1000
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > maxAgeMs) {
      throw new Error('SSO inválido o expirado.')
    }

    const user = normalizeUser(payload.user)
    if (user.role !== 'admin') throw new Error('SSO inválido o expirado.')

    authStore.setSession(user, payload.token)
    await authStore.restoreSession()
    if (!authStore.user || authStore.user.role !== 'admin' || !authStore.token) {
      throw new Error('SSO inválido o expirado.')
    }
    return true
  }

  return { processFromQuery }
}
