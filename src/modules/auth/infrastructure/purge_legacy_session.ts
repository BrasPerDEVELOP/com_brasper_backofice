/**
 * Borra la sesión que las versiones anteriores guardaban en `localStorage`.
 *
 * Hasta el cambio a access token en memoria + refresh en cookie `HttpOnly`, el
 * panel persistía `token` (bearer de larga duración) y `auth_user` (email,
 * documento y teléfono del usuario). El código actual ya no lee ni escribe esas
 * claves, así que sin esta purga seguirían en el navegador de cada usuario
 * indefinidamente después del despliegue.
 */
const LEGACY_SESSION_KEYS = ['token', 'auth_user'] as const

export function purgeLegacySession(): void {
  if (typeof localStorage === 'undefined') return
  for (const key of LEGACY_SESSION_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // localStorage puede fallar en modo privado; no debe impedir arrancar la app.
    }
  }
}
