/**
 * Configuración de entorno.
 * Vite expone solo variables prefijadas con VITE_.
 * El .env se carga al build/dev; no se lee en runtime desde disco.
 */

function getEnv(key: string, fallback = ''): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value : fallback
}

function getBoolEnv(key: string, fallback = false): boolean {
  const value = import.meta.env[key]
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  return fallback
}

export const env = {
  /** Tema oscuro (true) o claro (false) */
  get dark(): boolean {
    return getBoolEnv('VITE_DARK', false)
  },

  /** Usar HTTPS (true) o HTTP (false) */
  get ssl(): boolean {
    return getBoolEnv('VITE_SSL', true)
  },

  /** URL base completa del API (opcional). Ej. https://apibras.finzeler.com */
  get apiBaseUrl(): string {
    const raw = getEnv('VITE_API_BASE_URL', '').trim()
    if (!raw) return ''
    // Normaliza protocolo aunque .env diga http:// (evita CORS en DELETE, etc.)
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      const u = new URL(withProto)
      const host = u.hostname.toLowerCase()
      const isLocal =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('0.0.0.0')
      if (!isLocal) u.protocol = 'https:'
      else if (this.ssl) u.protocol = 'https:'
      return `${u.protocol}//${u.host}`
    } catch {
      return raw.replace(/\/$/, '')
    }
  },

  /** Dominio de la API, ej. api.demo.zefiron.com */
  get domain(): string {
    return getEnv('VITE_DOMAIN', '')
  },

  /** Prefijo de ruta opcional (empresa/tenant) */
  get company(): string {
    return getEnv('VITE_COMPANY', '')
  },

  /** Ruta para perfil de usuario (ej: me, profile, users/me). Por defecto: me */
  get authProfilePath(): string {
    return getEnv('VITE_AUTH_PROFILE_PATH', 'me')
  },

  /** Método HTTP para actualizar perfil: patch o put. Por defecto: put */
  get authProfileMethod(): 'patch' | 'put' {
    const v = getEnv('VITE_AUTH_PROFILE_METHOD', 'put').toLowerCase()
    return v === 'patch' ? 'patch' : 'put'
  },

  /** Si true, usa users/{id}/ en lugar de me/ para actualizar perfil */
  get authProfileUseId(): boolean {
    return getBoolEnv('VITE_AUTH_PROFILE_USE_ID', false)
  },

  /** URL base para media (imágenes). Si vacío, usa buildBaseUrl() + /media */
  get mediaBaseUrl(): string {
    return getEnv('VITE_MEDIA_BASE_URL', '').trim()
  },

  /** País por defecto */
  get country(): string {
    return getEnv('VITE_COUNTRY', 'US')
  },

  /** Usuario para prellenar login (desarrollo) */
  get username(): string {
    return getEnv('VITE_USERNAME', '')
  },

  /** Contraseña para prellenar login (desarrollo) */
  get password(): string {
    return getEnv('VITE_PASSWORD', '')
  },

  /** Nivel de log: debug | info | warn | error (en prod por defecto: warn) */
  get logLevel(): string {
    return getEnv('VITE_LOG_LEVEL', import.meta.env.PROD ? 'warn' : 'debug')
  },

  /** Secreto compartido para descifrar redirección SSO admin. */
  get adminRedirectSecret(): string {
    return getEnv('VITE_ADMIN_REDIRECT_SECRET', '')
  },

  /** Ventana máxima (segundos) para aceptar payload SSO. */
  get adminSsoMaxAgeSeconds(): number {
    const raw = getEnv('VITE_ADMIN_SSO_MAX_AGE_SECONDS', '60')
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60
  },

  /** Ruta del endpoint de importación de transacciones. Si vacío, no hay import masivo. */
  get transactionsImportPath(): string {
    return getEnv('VITE_TRANSACTIONS_IMPORT_PATH', 'transactions/import/')
  }
}
