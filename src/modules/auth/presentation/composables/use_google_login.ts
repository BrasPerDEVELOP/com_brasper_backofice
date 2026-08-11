import { computed } from 'vue'
import { env } from '@/interface/config/env'
import { useAuthStore } from '../controllers/use_auth_store_controller'
import { buildGoogleAuthorizeUrl, resolveGoogleCallback } from '../../infrastructure/google_oauth'
import {
  clearPendingOAuthState,
  readPendingOAuthState,
  startPendingOAuthState
} from '../../infrastructure/oauth_state'

/**
 * Google Login con flujo "authorization code":
 * 1. `startLogin()` redirige al diálogo OAuth guardando un `state` antifalsificación.
 * 2. Google vuelve al login con `?code=&state=`.
 * 3. `processFromQuery()` valida el `state` y manda el `code` al backend.
 */
export function useGoogleLogin() {
  const authStore = useAuthStore()

  /** Sin Client ID configurado el botón no se muestra: el flujo no puede funcionar. */
  const isEnabled = computed(() => Boolean(env.googleClientId))

  /** Debe coincidir con los "Authorized redirect URIs" de Google Cloud Console. */
  function resolveRedirectUri(): string {
    return env.googleRedirectUri || `${window.location.origin}/`
  }

  function startLogin(): void {
    if (!isEnabled.value) {
      throw new Error('Falta configurar VITE_GOOGLE_CLIENT_ID en esta app.')
    }
    const state = startPendingOAuthState('google')
    window.location.assign(
      buildGoogleAuthorizeUrl({
        clientId: env.googleClientId,
        redirectUri: resolveRedirectUri(),
        state,
        scope: env.googleScope
      })
    )
  }

  /** True solo si esta pestaña inició el flujo y Google devolvió una respuesta. */
  function hasPendingCallback(search: URLSearchParams): boolean {
    return resolveGoogleCallback(search, readPendingOAuthState('google')).status !== 'ignored'
  }

  /** Devuelve true si quedó una sesión abierta. Lanza si Google o el backend rechazan. */
  async function processFromQuery(search: URLSearchParams): Promise<boolean> {
    const callback = resolveGoogleCallback(search, readPendingOAuthState('google'))
    if (callback.status === 'ignored') return false

    clearPendingOAuthState('google')
    if (callback.status === 'failed') throw new Error(callback.message)

    await authStore.loginWithGoogle({ code: callback.code, redirectUri: resolveRedirectUri() })
    return authStore.isAuthenticated
  }

  return { isEnabled, startLogin, hasPendingCallback, processFromQuery }
}
