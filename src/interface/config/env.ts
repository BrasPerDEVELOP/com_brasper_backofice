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
  /**
   * Versión de la app derivada del commit de git (inyectada por Vite en build/dev).
   * `env.appVersion.flavor` es la cadena legible; `.commit`/`.commitCount` mapean
   * al commit exacto. Ver `scripts/app-version.mjs`.
   */
  get appVersion(): AppVersion {
    return __APP_VERSION__
  },

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

  /** URL base para WebSockets (opcional). Ej. wss://apibras.finzeler.com o ws://localhost:8000 */
  get wsBaseUrl(): string {
    return getEnv('VITE_WS_BASE_URL', '').trim()
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

  /**
   * Usuario para prellenar login. Solo en desarrollo (`import.meta.env.DEV`);
   * en builds de producción devuelve '' para no exponer credenciales.
   * No definir `VITE_USERNAME`/`VITE_PASSWORD` en el `.env` de producción.
   */
  get username(): string {
    return import.meta.env.DEV ? getEnv('VITE_USERNAME', '') : ''
  },

  /** Contraseña para prellenar login. Solo en desarrollo (ver `username`). */
  get password(): string {
    return import.meta.env.DEV ? getEnv('VITE_PASSWORD', '') : ''
  },

  /** Nivel de log: debug | info | warn | error (en prod por defecto: warn) */
  get logLevel(): string {
    return getEnv('VITE_LOG_LEVEL', import.meta.env.PROD ? 'warn' : 'debug')
  },

  /** Ruta del endpoint de importación de transacciones. Si vacío, no hay import masivo. */
  get transactionsImportPath(): string {
    return getEnv('VITE_TRANSACTIONS_IMPORT_PATH', 'transactions/import')
  },

  /** Ruta del endpoint de métricas semanales. Por defecto: metrics/weekly */
  get metricsWeeklyPath(): string {
    return getEnv('VITE_METRICS_WEEKLY_PATH', 'metrics/weekly')
  },

  /** App ID de Facebook Login. Si está vacío, el botón de Facebook no se muestra. */
  get facebookAppId(): string {
    return getEnv('VITE_FACEBOOK_APP_ID', '').trim()
  },

  /** Endpoint que canjea el `code` de Facebook por una sesión Brasper. */
  get facebookAuthPath(): string {
    return getEnv('VITE_FACEBOOK_AUTH_PATH', 'auth/facebook/').trim() || 'auth/facebook/'
  },

  /** Versión del Graph API usada en el diálogo OAuth. */
  get facebookApiVersion(): string {
    return getEnv('VITE_FACEBOOK_API_VERSION', 'v19.0').trim() || 'v19.0'
  },

  /** Permisos solicitados a Facebook (separados por coma). */
  get facebookScope(): string {
    return getEnv('VITE_FACEBOOK_SCOPE', 'email,public_profile').trim() || 'email,public_profile'
  },

  /**
   * `redirect_uri` exacto registrado en la app de Facebook. Si está vacío se usa
   * el origin actual + `/` (la ruta del login). Debe coincidir carácter por
   * carácter entre el diálogo OAuth y el canje del code en el backend.
   */
  get facebookRedirectUri(): string {
    return getEnv('VITE_FACEBOOK_REDIRECT_URI', '').trim()
  },

  /**
   * Client ID de Google Login (termina en `.apps.googleusercontent.com`).
   * Si está vacío, el botón de Google no se muestra. El client *secret* nunca
   * va aquí: lo usa el backend para canjear el `code`.
   */
  get googleClientId(): string {
    return getEnv('VITE_GOOGLE_CLIENT_ID', '').trim()
  },

  /** Endpoint que canjea el `code` de Google por una sesión Brasper. */
  get googleAuthPath(): string {
    return getEnv('VITE_GOOGLE_AUTH_PATH', 'auth/google/').trim() || 'auth/google/'
  },

  /** Permisos solicitados a Google (separados por espacio, como exige OAuth 2.0). */
  get googleScope(): string {
    return getEnv('VITE_GOOGLE_SCOPE', 'openid email profile').trim() || 'openid email profile'
  },

  /**
   * `redirect_uri` exacto registrado en Google Cloud Console ("Authorized redirect
   * URIs"). Si está vacío se usa el origin actual + `/` (la ruta del login). Debe
   * coincidir carácter por carácter entre el diálogo OAuth y el canje del code.
   */
  get googleRedirectUri(): string {
    return getEnv('VITE_GOOGLE_REDIRECT_URI', '').trim()
  }
}
