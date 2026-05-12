import { defineStore } from 'pinia'
import { getDefaultPermissionsForRole, normalizePermissions, type PermissionKey, type User } from '../../domain/models'
import type { UpdateProfilePayload } from '../../infrastructure/adapters/auth_repository'
import { LoginUseCase } from '../../application/use_cases'
import { AuthApiAdapter } from '../../infrastructure/adapters'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
}

const TOKEN_KEY = 'token'
const USER_KEY = 'auth_user'

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (data === null || typeof data !== 'object') return null
    const o = data as Record<string, unknown>
    if (o.id == null || o.email == null) return null
    const names = o.names != null ? String(o.names) : null
    const lastnames = o.lastnames != null ? String(o.lastnames) : null
    const email = String(o.email)
    const name = [names, lastnames].filter(Boolean).join(' ') || email
    const phoneVal = o.phone
    const phone = typeof phoneVal === 'number' ? phoneVal : (typeof phoneVal === 'string' && phoneVal ? Number(phoneVal) : null)
    return {
      id: String(o.id),
      email,
      names,
      lastnames,
      name,
      document_number: o.document_number != null ? String(o.document_number) : null,
      document_type: o.document_type != null ? String(o.document_type) : null,
      profile_image: o.profile_image != null ? String(o.profile_image) : null,
      is_agent: Boolean(o.is_agent),
      role: o.role != null ? String(o.role) : null,
      phone: Number.isFinite(phone) ? phone : null,
      code_phone: o.code_phone != null ? String(o.code_phone) : null,
      permissions: normalizePermissions(o.permissions, o.role != null ? String(o.role) : null),
      must_change_password: Boolean(o.must_change_password)
    }
  } catch {
    return null
  }
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
    is_agent: user.is_agent,
    role: user.role ?? undefined,
    phone: changes.phone ?? user.phone ?? undefined,
    code_phone: (changes.code_phone ?? user.code_phone ?? '').trim() || undefined
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem(TOKEN_KEY),
    isLoading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    isAdmin: (state) => state.user?.role === 'admin',
    permissions: (state) =>
      state.user?.permissions?.length
        ? state.user.permissions
        : getDefaultPermissionsForRole(state.user?.role)
  },

  actions: {
    setSession(user: User, token: string) {
      this.user = user
      this.token = token
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    },

    clearSession() {
      this.user = null
      this.token = null
      this.error = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },

    /** Permite al controlador establecer errores desde flujos externos (SSO, validaciones). */
    setError(message: string | null) {
      this.error = message
    },

    /**
     * Valida que el usuario actual tenga rol admin. El controlador centraliza
     * esta validación para evitar mutaciones directas del estado desde las vistas.
     * @returns true si el usuario es admin
     */
    validateAdminAccess(): boolean {
      const user = this.user
      if (!user) {
        this.error = 'Error: No se pudo obtener información del usuario'
        return false
      }
      if (user.role !== 'admin') {
        this.error = 'Solo usuarios con rol admin pueden acceder'
        return false
      }
      return true
    },

    hasPermission(permission: PermissionKey | string): boolean {
      if (this.user?.role === 'admin') return true
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

    async logout() {
      const repository = new AuthApiAdapter()
      await repository.logout()
      this.clearSession()
    },

    restoreUser() {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) return
      this.token = token
      const user = loadStoredUser()
      this.user = user
      if (!user) {
        this.token = null
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    },

    /**
     * Valida la sesión en el backend (GET /user/{id}).
     * Si hay token y user.id, obtiene el usuario actual.
     */
    async restoreSession(): Promise<void> {
      const token = this.token ?? localStorage.getItem(TOKEN_KEY)
      if (!token) return
      this.token = token
      const storedUser = loadStoredUser()
      if (!storedUser?.id) return
      try {
        const repository = new AuthApiAdapter()
        const user = await repository.getCurrentUser(storedUser.id)
        if (user) {
          this.user = user
          localStorage.setItem(USER_KEY, JSON.stringify(user))
        }
      } catch {
        // Errores de red u otros
      }
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
          localStorage.setItem(USER_KEY, JSON.stringify(user))
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
          localStorage.setItem(USER_KEY, JSON.stringify(this.user))
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
