import { defineStore } from 'pinia'
import {
  ALL_PERMISSIONS,
  getDefaultPermissionsForRole,
  isAdminRole,
  normalizeStoredRole,
  type PermissionKey,
  type User
} from '../../domain/models'
import type {
  FacebookLoginPayload,
  GoogleLoginPayload,
  UpdateProfilePayload
} from '../../infrastructure/adapters/auth_repository'
import { FacebookLoginUseCase, GoogleLoginUseCase, LoginUseCase } from '../../application/use_cases'
import { AuthApiAdapter } from '../../infrastructure/adapters'
import { refreshAccessToken } from '@/interface/api/client'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
}

/** Construye el payload para PUT /user/ (FormData). Si changes.profile_image es File, se envía para actualizar la imagen. */
function buildPutPayload(
  user: User,
  changes: {
    names?: string | null
    lastnames?: string | null
    document_number?: string | null
    document_type?: string | null
    phone?: number | null
    code_phone?: string | null
    profile_image?: File | null
  }
): UpdateProfilePayload {
  return {
    id: user.id,
    names: (changes.names ?? user.names ?? '').trim() || undefined,
    lastnames: (changes.lastnames ?? user.lastnames ?? '').trim() || undefined,
    email: user.email,
    profile_image: changes.profile_image instanceof File ? changes.profile_image : undefined,
    document_number: (changes.document_number ?? user.document_number ?? '').trim() || undefined,
    document_type: (changes.document_type ?? user.document_type ?? '').trim() || undefined,
    phone: changes.phone ?? user.phone ?? undefined,
    code_phone: (changes.code_phone ?? user.code_phone ?? '').trim() || undefined
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    isLoading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    isAdmin: (state) => isAdminRole(state.user?.role),
    // `parseUser` ya sustituye una lista vacía por los defaults del rol, así que
    // aquí solo queda cubrir el caso sin usuario cargado.
    permissions: (state) =>
      state.user?.permissions ?? getDefaultPermissionsForRole(state.user?.role)
  },

  actions: {
    setSession(user: User, token: string) {
      this.user = user
      this.token = token
    },

    setAccessToken(token: string | null) {
      this.token = token
    },

    clearSession() {
      this.user = null
      this.token = null
      this.error = null
    },

    /** Permite al controlador establecer errores desde validaciones de acceso. */
    setError(message: string | null) {
      this.error = message
    },

    /**
     * Valida que el usuario pueda usar el backoffice (no solo admin: asesores/ventas, etc.).
     * Bloquea rol `client` y cuentas sin ningún permiso conocido.
     */
    validateBackofficeAccess(): boolean {
      const user = this.user
      if (!user) {
        this.error = 'Error: No se pudo obtener información del usuario'
        return false
      }
      const role = normalizeStoredRole(user.role)
      if (role === 'client') {
        this.error = 'Este panel es para el equipo interno. Los clientes usan el portal público.'
        return false
      }
      const perms = this.permissions
      const allowed = new Set<string>(ALL_PERMISSIONS)
      const hasAnyPanelPermission = perms.some((p) => allowed.has(p))
      if (!hasAnyPanelPermission) {
        this.error = 'Tu cuenta no tiene permisos para este panel. Consulta con un administrador.'
        return false
      }
      return true
    },

    hasPermission(permission: PermissionKey | string): boolean {
      if (isAdminRole(this.user?.role)) return true
      return this.permissions.includes(permission)
    },

    hasAnyPermission(permissions: Array<PermissionKey | string>): boolean {
      if (permissions.length === 0) return true
      return permissions.some((permission) => this.hasPermission(permission))
    },

    async login(username: string, password: string) {
      this.isLoading = true
      this.error = null

      try {
        const repository = new AuthApiAdapter()
        const loginUseCase = new LoginUseCase(repository)
        const { user, token } = await loginUseCase.execute(username, password)

        this.setSession(user, token)
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Error al iniciar sesión'
        throw error
      } finally {
        this.isLoading = false
      }
    },

    /** Abre sesión con el `code` que devolvió el diálogo OAuth de Facebook. */
    async loginWithFacebook(payload: FacebookLoginPayload) {
      this.isLoading = true
      this.error = null

      try {
        const repository = new AuthApiAdapter()
        const facebookLoginUseCase = new FacebookLoginUseCase(repository)
        const { user, token } = await facebookLoginUseCase.execute(payload)

        this.setSession(user, token)
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Error al iniciar sesión con Facebook'
        throw error
      } finally {
        this.isLoading = false
      }
    },

    /** Abre sesión con el `code` que devolvió el diálogo OAuth de Google. */
    async loginWithGoogle(payload: GoogleLoginPayload) {
      this.isLoading = true
      this.error = null

      try {
        const repository = new AuthApiAdapter()
        const googleLoginUseCase = new GoogleLoginUseCase(repository)
        const { user, token } = await googleLoginUseCase.execute(payload)

        this.setSession(user, token)
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Error al iniciar sesión con Google'
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async logout() {
      const repository = new AuthApiAdapter()
      try {
        await repository.logout()
      } finally {
        this.clearSession()
      }
    },

    /**
     * Restaura la sesión desde la cookie HttpOnly y valida el usuario en el API.
     */
    async restoreSession(): Promise<boolean> {
      if (this.token && this.user) return true
      try {
        if (!this.token) this.token = await refreshAccessToken()
        const repository = new AuthApiAdapter()
        const user = await repository.getCurrentUser('current')
        if (user) {
          this.user = user
          return true
        }
      } catch {
        this.clearSession()
      }
      return false
    },

    async updateProfile(changes: {
      names?: string | null
      lastnames?: string | null
      document_number?: string | null
      document_type?: string | null
      phone?: number | null
      code_phone?: string | null
      profile_image?: File | null
    }) {
      if (!this.user) return
      this.isLoading = true
      this.error = null
      try {
        const repository = new AuthApiAdapter()
        const payload = buildPutPayload(this.user, changes)
        const user = await repository.updateProfile(payload)
        if (user) {
          this.user = user
        }
      } catch (e: unknown) {
        const err = e as { response?: { status?: number; data?: unknown } }
        if (err.response?.status === 422 && err.response?.data != null) {
          const data = err.response.data as Record<string, unknown>
          const detail = data.detail
          const msg =
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? (detail as Array<{ msg?: string }>)
                    .map((d) => d.msg ?? JSON.stringify(d))
                    .join(', ')
                : typeof detail === 'object' && detail != null
                  ? JSON.stringify(detail)
                  : 'Error de validación (422)'
          this.error = msg
        } else {
          this.error = e instanceof Error ? e.message : 'Error al actualizar perfil'
        }
        throw e
      } finally {
        this.isLoading = false
      }
    },

    async changePassword(payload: { current_password: string; new_password: string }) {
      this.isLoading = true
      this.error = null
      try {
        const repository = new AuthApiAdapter()
        await repository.changePassword(payload)
        if (this.user?.must_change_password) {
          this.user = { ...this.user, must_change_password: false }
        }
      } catch (e: unknown) {
        const err = e as { response?: { status?: number; data?: unknown } }
        const data = err.response?.data
        const detail =
          data != null && typeof data === 'object'
            ? (data as Record<string, unknown>).detail
            : null
        this.error =
          typeof detail === 'string'
            ? detail
            : e instanceof Error
              ? e.message
              : 'Error al cambiar contraseña'
        throw e
      } finally {
        this.isLoading = false
      }
    }
  }
})
