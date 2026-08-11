/**
 * Helpers puros del flujo OAuth "authorization code" de Google Login.
 *
 * El navegador nunca ve el client secret: solo pide un `code` a Google y lo
 * reenvía al backend, que lo canjea por una sesión Brasper.
 */

export interface GoogleAuthorizeUrlInput {
  clientId: string
  redirectUri: string
  state: string
  scope: string
}

/** Arma la URL del diálogo OAuth de Google. */
export function buildGoogleAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  scope
}: GoogleAuthorizeUrlInput): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', scope)
  url.searchParams.set('response_type', 'code')
  // El backoffice se usa con varias cuentas: siempre ofrecer el selector.
  url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

export type GoogleCallback =
  /** La query no corresponde a un retorno de Google: no tocar el login. */
  | { status: 'ignored' }
  /** Google devolvió un error o el `state` no coincide. */
  | { status: 'failed'; message: string }
  /** Hay un `code` válido listo para canjear en el backend. */
  | { status: 'ready'; code: string }

/**
 * Interpreta la query de retorno de Google.
 *
 * Solo se considera un retorno cuando hay un `state` pendiente guardado por
 * esta pestaña; así un `?code=` ajeno no dispara el flujo. El `state` protege
 * contra CSRF: si no coincide, se rechaza.
 */
export function resolveGoogleCallback(
  search: URLSearchParams,
  expectedState: string | null
): GoogleCallback {
  const code = search.get('code')
  const errorCode = search.get('error')
  if (!expectedState) return { status: 'ignored' }
  if (!code && !errorCode) return { status: 'ignored' }

  if (errorCode) {
    const description = search.get('error_description') ?? search.get('error_subtype')
    return {
      status: 'failed',
      message: description
        ? `Google rechazó el acceso: ${description.replace(/\+/g, ' ')}`
        : 'No se completó el inicio de sesión con Google.'
    }
  }

  if (search.get('state') !== expectedState) {
    return {
      status: 'failed',
      message: 'Respuesta de Google inválida o expirada. Vuelve a intentarlo.'
    }
  }

  return { status: 'ready', code: code as string }
}
