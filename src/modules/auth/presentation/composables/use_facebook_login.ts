import { computed } from 'vue'
import { env } from '@/interface/config/env'
import { useAuthStore } from '../controllers/use_auth_store_controller'
import { buildFacebookAuthorizeUrl, resolveFacebookCallback } from '../../infrastructure/facebook_oauth'
import {
  clearPendingOAuthState,
  readPendingOAuthState,
  startPendingOAuthState
} from '../../infrastructure/oauth_state'

/**
 * Facebook Login con flujo "authorization code":
 * 1. `startLogin()` redirige al diálogo OAuth guardando un `state` antifalsificación.
 * 2. Facebook vuelve al login con `?code=&state=`.
 * 3. `processFromQuery()` valida el `state` y manda el `code` al backend.
 */
export function useFacebookLogin() {
  const authStore = useAuthStore()

  /** Sin App ID configurado el botón no se muestra: el flujo no puede funcionar. */
  const isEnabled = computed(() => Boolean(env.facebookAppId))

  /** Debe coincidir con los "Valid OAuth Redirect URIs" de la app de Meta. */
  function resolveRedirectUri(): string {
    return env.facebookRedirectUri || `${window.location.origin}/`
  }

  function startLogin(): void {
    if (!isEnabled.value) {
      throw new Error('Falta configurar VITE_FACEBOOK_APP_ID en esta app.')
    }
    const state = startPendingOAuthState('facebook')
    window.location.assign(
      buildFacebookAuthorizeUrl({
        appId: env.facebookAppId,
        redirectUri: resolveRedirectUri(),
        state,
        scope: env.facebookScope,
        apiVersion: env.facebookApiVersion
      })
    )
  }

  /** True solo si esta pestaña inició el flujo y Facebook devolvió una respuesta. */
  function hasPendingCallback(search: URLSearchParams): boolean {
    return resolveFacebookCallback(search, readPendingOAuthState('facebook')).status !== 'ignored'
  }

  /** Devuelve true si quedó una sesión abierta. Lanza si Facebook o el backend rechazan. */
  async function processFromQuery(search: URLSearchParams): Promise<boolean> {
    const callback = resolveFacebookCallback(search, readPendingOAuthState('facebook'))
    if (callback.status === 'ignored') return false

    clearPendingOAuthState('facebook')
    if (callback.status === 'failed') throw new Error(callback.message)

    await authStore.loginWithFacebook({ code: callback.code, redirectUri: resolveRedirectUri() })
    return authStore.isAuthenticated
  }

  return { isEnabled, startLogin, hasPendingCallback, processFromQuery }
}
