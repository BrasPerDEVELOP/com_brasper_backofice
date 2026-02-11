import { defineStore } from 'pinia'
import type { User } from '../../domain/models'
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
    return {
      id: String(o.id),
      email,
      names,
      lastnames,
      name,
      document_number: o.document_number != null ? String(o.document_number) : null,
      profile_image: o.profile_image != null ? String(o.profile_image) : null,
      role: o.role != null ? String(o.role) : null
    }
  } catch {
    return null
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
    /** Verifica si el usuario tiene rol 'admin' */
    isAdmin: (state) => state.user?.role === 'admin'
  },

  actions: {
    async login(username: string, password: string) {
      this.isLoading = true
      this.error = null

      try {
        const repository = new AuthApiAdapter()
        const loginUseCase = new LoginUseCase(repository)
        const { user, token } = await loginUseCase.execute(username, password)
        
        // Guardar usuario y token en el estado
        this.user = user
        this.token = token
        
        // Guardar en localStorage
        if (token) localStorage.setItem(TOKEN_KEY, token)
        if (user) {
          localStorage.setItem(USER_KEY, JSON.stringify(user))
          // Log para depuración (solo en desarrollo)
          if (import.meta.env.DEV) {
            console.log('Usuario guardado:', { id: user.id, email: user.email, role: user.role })
          }
        }
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
      this.user = null
      this.token = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },

    /** Restaurar usuario solo desde localStorage (sin validar en backend). */
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
     * Valida la sesión en el backend (GET /auth/me/).
     * Si hay token, obtiene el usuario actual; si responde 401, el interceptor
     * del apiClient cierra sesión y redirige a /auth.
     */
    async restoreSession(): Promise<void> {
      const token = this.token ?? localStorage.getItem(TOKEN_KEY)
      if (!token) return
      this.token = token
      try {
        const repository = new AuthApiAdapter()
        const user = await repository.getCurrentUser()
        if (user) {
          this.user = user
          localStorage.setItem(USER_KEY, JSON.stringify(user))
        }
        // Si 401, el interceptor del apiClient ya llama a onUnauthorized (logout + redirect)
      } catch {
        // Errores de red u otros: no forzamos logout; el 401 lo gestiona el interceptor
      }
    }
  }
})
