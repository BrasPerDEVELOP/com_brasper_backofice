/**
 * Helpers puros del flujo OAuth "authorization code" de Facebook Login.
 *
 * El navegador nunca ve el app secret: solo pide un `code` a Facebook y lo
 * reenvía al backend, que lo canjea por una sesión Brasper.
 */

export interface FacebookAuthorizeUrlInput {
  appId: string
  redirectUri: string
  state: string
  scope: string
  apiVersion: string
}

/** Arma la URL del diálogo OAuth de Facebook. */
export function buildFacebookAuthorizeUrl({
  appId,
  redirectUri,
  state,
  scope,
  apiVersion
}: FacebookAuthorizeUrlInput): string {
  const version = apiVersion.startsWith('v') ? apiVersion : `v${apiVersion}`
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', scope)
  url.searchParams.set('response_type', 'code')
  return url.toString()
}

export type FacebookCallback =
  /** La query no corresponde a un retorno de Facebook: no tocar el login. */
  | { status: 'ignored' }
  /** Facebook devolvió un error o el `state` no coincide. */
  | { status: 'failed'; message: string }
  /** Hay un `code` válido listo para canjear en el backend. */
  | { status: 'ready'; code: string }

/**
 * Interpreta la query de retorno de Facebook.
 *
 * Solo se considera un retorno cuando hay un `state` pendiente guardado por
 * esta pestaña; así un `?code=` ajeno (p. ej. un cupón compartido por link) no
 * dispara el flujo. El `state` protege contra CSRF: si no coincide, se rechaza.
 */
export function resolveFacebookCallback(
  search: URLSearchParams,
  expectedState: string | null
): FacebookCallback {
  const code = search.get('code')
  const errorCode = search.get('error') ?? search.get('error_code')
  if (!expectedState) return { status: 'ignored' }
  if (!code && !errorCode) return { status: 'ignored' }

  if (errorCode) {
    const description = search.get('error_description') ?? search.get('error_reason')
    return {
      status: 'failed',
      message: description
        ? `Facebook rechazó el acceso: ${description.replace(/\+/g, ' ')}`
        : 'No se completó el inicio de sesión con Facebook.'
    }
  }

  if (search.get('state') !== expectedState) {
    return { status: 'failed', message: 'Respuesta de Facebook inválida o expirada. Vuelve a intentarlo.' }
  }

  return { status: 'ready', code: code as string }
}
