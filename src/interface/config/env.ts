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

  /** Dominio de la API, ej. api.demo.zefiron.com */
  get domain(): string {
    return getEnv('VITE_DOMAIN', '')
  },

  /** Prefijo de ruta opcional (empresa/tenant) */
  get company(): string {
    return getEnv('VITE_COMPANY', '')
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
  }
}
