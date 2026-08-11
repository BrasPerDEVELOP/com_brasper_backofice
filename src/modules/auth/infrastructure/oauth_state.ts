/**
 * `state` antifalsificación compartido por los flujos OAuth (Facebook y Google).
 *
 * Vive en sessionStorage para sobrevivir la redirección al proveedor. Solo puede
 * haber un flujo pendiente a la vez: iniciar uno descarta el del otro proveedor,
 * porque ambos vuelven a la misma URL (`?code=&state=`) y un `state` huérfano
 * haría que el proveedor equivocado reclamara el callback y lo rechazara.
 */

export type OAuthProvider = 'facebook' | 'google'

const STATE_KEYS: Record<OAuthProvider, string> = {
  facebook: 'facebook_oauth_state',
  google: 'google_oauth_state'
}

export function createOAuthState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Genera y guarda el `state` del proveedor, descartando cualquier flujo pendiente. */
export function startPendingOAuthState(provider: OAuthProvider): string {
  for (const key of Object.values(STATE_KEYS)) sessionStorage.removeItem(key)
  const state = createOAuthState()
  sessionStorage.setItem(STATE_KEYS[provider], state)
  return state
}

export function readPendingOAuthState(provider: OAuthProvider): string | null {
  return sessionStorage.getItem(STATE_KEYS[provider])
}

export function clearPendingOAuthState(provider: OAuthProvider): void {
  sessionStorage.removeItem(STATE_KEYS[provider])
}
